const express = require('express');
const { authMiddleware } = require('../middlewares/authMiddleware');
const User = require('../Models/User');
const router = express.Router();

const SAFE_SELECT = '-password -verificationToken -verificationTokenExpiry -resetPasswordToken -resetPasswordTokenExpiry -refreshTokenHash';

// Returns the full user profile (excluding sensitive auth fields)
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