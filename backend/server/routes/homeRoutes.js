const express = require('express');
const { authMiddleware } = require('../middlewares/authMiddleware');
const User = require('../Models/User');
const router = express.Router();

const SAFE_SELECT = '-password -verificationToken -verificationTokenExpiry -resetPasswordToken -resetPasswordTokenExpiry -refreshTokenHash';

// ── Twilio client (only initialised when credentials are present) ────────────
function getTwilioClient() {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return null;
    const twilio = require('twilio');
    return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

function buildSOSMessage({ patientName, symptoms, urgency, duration, location }) {
    const symptomText = symptoms && symptoms.length
        ? symptoms.join(', ')
        : 'unspecified symptoms';
    return (
        `🚨 EMERGENCY ALERT 🚨\n` +
        `${patientName} needs immediate medical help!\n\n` +
        `Symptoms: ${symptomText}\n` +
        `Urgency: ${urgency}\n` +
        `Duration: ${duration}\n` +
        `Location: ${location}\n\n` +
        `Please call them or go to their location immediately.`
    );
}

// SOS — send SMS + voice call to all linked relatives
router.post('/emergency/sos', authMiddleware, async (req, res) => {
    const { userId } = req.userInfo;
    const { patientName, symptoms, urgency, severity, duration, location } = req.body;

    if (!location) {
        return res.status(400).json({ success: false, message: 'location is required' });
    }

    try {
        // 1. Load current user and their relatives list
        const user = await User.findById(userId).select('relatives firstName');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const relatives = user.relatives || [];
        if (!relatives.length) {
            return res.status(200).json({
                success: true,
                notified: 0,
                message: 'No relatives linked to your account',
            });
        }

        // 2. Look up each relative's phone by their patientId
        const relativePatientIds = relatives.map(r => r.patientId);
        const relativeUsers = await User.find(
            { patientId: { $in: relativePatientIds } },
            'phone firstName patientId'
        );

        const phones = relativeUsers
            .map(u => u.phone?.trim())
            .filter(p => p && p.length >= 7);

        if (!phones.length) {
            return res.status(200).json({
                success: true,
                notified: 0,
                message: 'No phone numbers found for linked relatives',
            });
        }

        // 3. Compose message
        const name = patientName || user.firstName || 'Patient';
        const message = buildSOSMessage({
            patientName: name,
            symptoms: Array.isArray(symptoms) ? symptoms : [],
            urgency: urgency || 'Emergency',
            duration: duration || 'unknown',
            location,
        });

        // 4. Send via Twilio (if configured)
        const client = getTwilioClient();
        const fromNumber = process.env.TWILIO_FROM_NUMBER;

        if (!client || !fromNumber) {
            console.warn('Twilio not configured — SOS message (not sent):\n', message);
            return res.status(200).json({
                success: true,
                notified: 0,
                warning: 'Twilio credentials not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER to .env',
                message_preview: message,
            });
        }

        const results = await Promise.allSettled(
            phones.flatMap(to => [
                // SMS
                client.messages.create({ body: message, from: fromNumber, to }),
                // Voice call with TwiML read-out
                client.calls.create({
                    twiml: `<Response><Say voice="alice">${message.replace(/[<>&"]/g, '')}</Say></Response>`,
                    from: fromNumber,
                    to,
                }),
            ])
        );

        const failed = results.filter(r => r.status === 'rejected');
        if (failed.length) {
            failed.forEach(f => console.error('Twilio error:', f.reason));
        }

        res.json({ success: true, notified: phones.length, failed: failed.length });
    } catch (err) {
        console.error('SOS endpoint error:', err);
        res.status(500).json({ success: false, message: 'Server error during SOS dispatch' });
    }
});

// Proxy for the emergency ambulance call — avoids browser CORS restrictions
router.post('/emergency/call', async (req, res) => {
    const { name, location } = req.body;
    if (!name || !location) {
        return res.status(400).json({ success: false, message: 'name and location are required' });
    }
    try {
        const upstream = await fetch(
            'https://muddy-wynn-codeshunt-c2861863.koyeb.app/call/emergency',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, location }),
            }
        );
        const text = await upstream.text();
        res.status(upstream.status).send(text);
    } catch (err) {
        console.error('Emergency proxy error:', err);
        res.status(502).json({ success: false, message: 'Could not reach emergency service' });
    }
});

router.get('/home', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.userInfo;
        const user = await User.findById(userId).select(SAFE_SELECT);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ message: 'Welcome', user });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Updates the patient's hospital-sharing consent preference
router.patch('/home/share-preference', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.userInfo;
        const { shareWithHospital } = req.body;
        if (typeof shareWithHospital !== 'boolean') {
            return res.status(400).json({ success: false, message: 'shareWithHospital must be a boolean' });
        }
        const user = await User.findByIdAndUpdate(
            userId,
            { shareWithHospital },
            { new: true }
        ).select(SAFE_SELECT);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, user });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── Generic profile update ────────────────────────────────────────────────────
// Only allows updating white-listed fields for each role.
const ALLOWED_FIELDS = {
    common: ['firstName', 'lastName', 'phone', 'dateOfBirth', 'gender', 'age', 'coordinates', 'address', 'country', 'height', 'weight', 'unitSystem'],
    patient: ['allergies', 'medicalHistory', 'currentMedication', 'relatives', 'shareWithHospital'],
    asha:    ['district', 'village', 'patientsHandled', 'leavesTaken', 'rating'],
    admin:   ['adminDistrict', 'govNotifications', 'govGuidelines'],
};

router.patch('/home/profile', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.userInfo;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const allowed = [...ALLOWED_FIELDS.common, ...(ALLOWED_FIELDS[user.role] || [])];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }

        const updated = await User.findByIdAndUpdate(userId, updates, { new: true }).select(SAFE_SELECT);
        res.json({ success: true, user: updated });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;