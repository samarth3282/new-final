const User = require('../Models/User')
const PreAuthorized = require('../Models/PreAuthorized')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const { addToBlacklist } = require('../utils/tokenBlacklist')
const sendEmail = require('../utils/sendEmail')

// ─── Helpers ────────────────────────────────────────────────────────────────

const generateAccessToken = (user) =>
    jwt.sign(
        { userId: user._id, username: user.username, role: user.role },
        process.env.JWT_SECRET_KEY,
        { expiresIn: '30m' }
    );

const generateRefreshToken = (user) =>
    jwt.sign(
        { userId: user._id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d', jwtid: crypto.randomUUID() }
    );

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

const hashToken = (rawToken) =>
    crypto.createHash('sha256').update(rawToken).digest('hex');

const cookieOptions = {
    httpOnly: true,
    secure: true, // Must be true when sameSite is 'none'
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' allows cross-origin on Render
    maxAge: REFRESH_TTL_SECONDS * 1000
};

// ─── Register ────────────────────────────────────────────────────────────────

const generatePatientId = () =>
    `PAT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

const registerUser = async (req, res) => {
    try {
        console.log('[registerUser] req.body after validation:', JSON.stringify(req.body, null, 2));
        const { username, email, password, role, workerCode, lastName } = req.body;

        // ── Pre-authorization check for asha/admin ─────────────────────────
        let preAuthRecord = null;
        if (role === 'asha' || role === 'admin') {
            preAuthRecord = await PreAuthorized.findOne({
                role,
                workerCode: workerCode.toUpperCase(),
                lastName:   { $regex: new RegExp(`^${lastName}$`, 'i') } // case-insensitive
            });

            if (!preAuthRecord) {
                return res.status(403).json({
                    success: false,
                    message: 'Worker code or last name does not match our records. Please contact your administrator.'
                });
            }
            if (preAuthRecord.isUsed) {
                return res.status(403).json({
                    success: false,
                    message: 'This worker code has already been used to register. Please contact your administrator.'
                });
            }
        }

        const existingUser = await User.findOne({ $or: [{ username }, { email }] })
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with that username or email'
            })
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Generate email verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationTokenHash = hashToken(verificationToken);
        const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

        // Generate unique patientId for patient role; retry on collision
        let patientId;
        if (role === 'patient') {
            let attempts = 0;
            while (attempts < 5) {
                const candidate = generatePatientId();
                const exists = await User.findOne({ patientId: candidate });
                if (!exists) { patientId = candidate; break; }
                attempts++;
            }
            if (!patientId) {
                return res.status(500).json({ success: false, message: 'Could not generate a unique patient ID. Please try again.' });
            }
        }

        const newUser = await User.create({
            username,
            email,
            password: hashedPassword,
            role,
            lastName: lastName || '',
            ...(patientId ? { patientId } : {}),
            verificationToken: verificationTokenHash,
            verificationTokenExpiry
        });

        // Mark pre-auth slot as used so it cannot be reused
        if (preAuthRecord) {
            preAuthRecord.isUsed = true;
            preAuthRecord.usedBy = newUser._id;
            await preAuthRecord.save();
        }

        // Send verification email. If this fails, rollback the user so retry is clean.
        const verifyUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}&id=${newUser._id}`;
        try {
            await sendEmail(
                email,
                'Verify Your Email',
                `<h2>Welcome, ${username}!</h2>
                 <p>Click the link below to verify your email. This link expires in 24 hours.</p>
                 <a href="${verifyUrl}">${verifyUrl}</a>`
            );
        } catch (mailError) {
            await User.findByIdAndDelete(newUser._id);
            console.error('Verification email failed:', mailError.message);
            return res.status(502).json({
                success: false,
                message: 'Registration could not be completed because verification email failed to send. Please try again.'
            });
        }

        res.status(201).json({
            success: true,
            message: 'Registration successful! Please check your email to verify your account.'
        })

    } catch (e) {
        console.log(e);
        res.status(500).json({
            success: false,
            message: 'Registration failed. Please try again.'
        })
    }
}

// ─── Verify Email ─────────────────────────────────────────────────────────────

const verifyEmail = async (req, res) => {
    try {
        const { token, id } = req.query;

        if (!token || !id) {
            return res.status(400).json({ success: false, message: 'Invalid verification link' });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid verification link' });
        }
        if (user.isVerified) {
            return res.status(400).json({ success: false, message: 'Email already verified' });
        }
        const verificationTokenHash = hashToken(token);
        if (user.verificationToken !== verificationTokenHash || user.verificationTokenExpiry < new Date()) {
            return res.status(400).json({ success: false, message: 'Verification link is invalid or has expired' });
        }

        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpiry = undefined;
        await user.save();

        res.status(200).json({ success: true, message: 'Email verified successfully! You can now log in.' });

    } catch (e) {
        console.log(e);
        res.status(500).json({ success: false, message: 'Email verification failed.' });
    }
}

// ─── Login ────────────────────────────────────────────────────────────────────

const loginUser = async (req, res) => {
    try {
        const { identifier, password } = req.body;
        const user = await User.findOne({
            $or: [{ username: identifier }, { email: identifier.toLowerCase() }]
        })
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid credentials'
            })
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid credentials'
            })
        }

        if (!user.isVerified) {
            return res.status(403).json({
                success: false,
                message: 'Please verify your email before logging in'
            })
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);
        const refreshTokenHash = hashToken(refreshToken);

        user.refreshTokenHash = refreshTokenHash;
        await user.save();

        // Store refresh token in httpOnly cookie
        res.cookie('refreshToken', refreshToken, cookieOptions);

        res.status(200).json({
            success: true,
            message: 'Login successful!',
            accessToken
        })

    } catch (e) {
        console.log(e);
        res.status(500).json({
            success: false,
            message: 'Login failed. Please try again.'
        })
    }
}

// ─── Refresh Token ────────────────────────────────────────────────────────────

const refreshToken = async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        if (!token) {
            return res.status(401).json({ success: false, message: 'No refresh token provided' });
        }

        // Verify the refresh token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        } catch (e) {
            const message = e.name === 'TokenExpiredError' ? 'Refresh token expired. Please login again' : 'Invalid refresh token';
            return res.status(401).json({ success: false, message });
        }

        // Check if refresh token was blacklisted (force logout)
        const { isBlacklisted } = require('../utils/tokenBlacklist');
        if (await isBlacklisted(token)) {
            return res.status(401).json({ success: false, message: 'Refresh token revoked. Please login again' });
        }

        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        if (!user.refreshTokenHash || user.refreshTokenHash !== hashToken(token)) {
            return res.status(401).json({ success: false, message: 'Refresh token does not match active session' });
        }

        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);

        user.refreshTokenHash = hashToken(newRefreshToken);
        await user.save();

        // Rotate refresh token and revoke old token.
        await addToBlacklist(token, REFRESH_TTL_SECONDS);
        res.cookie('refreshToken', newRefreshToken, cookieOptions);

        res.status(200).json({
            success: true,
            accessToken: newAccessToken
        });

    } catch (e) {
        console.log(e);
        res.status(500).json({ success: false, message: 'Token refresh failed.' });
    }
}

// ─── Logout ───────────────────────────────────────────────────────────────────

const logoutUser = async (req, res) => {
    try {
        // Blacklist the access token
        const header = req.headers['authorization']
        const accessToken = header && header.split(' ')[1]
        if (accessToken) {
            await addToBlacklist(accessToken); // uses default 30min TTL
        }

        // Blacklist the refresh token from cookie
        const rToken = req.cookies?.refreshToken;
        if (rToken) {
            await addToBlacklist(rToken, REFRESH_TTL_SECONDS);

            try {
                const decoded = jwt.verify(rToken, process.env.JWT_REFRESH_SECRET);
                await User.findByIdAndUpdate(decoded.userId, { refreshTokenHash: null });
            } catch (e) {
                // If refresh token is invalid/expired we still clear cookie and continue logout.
            }
        }

        res.clearCookie('refreshToken', cookieOptions);
        res.status(200).json({ success: true, message: 'Logout successful!' })

    } catch (e) {
        console.log(e);
        res.status(500).json({ success: false, message: 'Logout failed.' })
    }
}

// ─── Forgot Password ──────────────────────────────────────────────────────────

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        // Always return success to prevent email enumeration
        if (!user) {
            return res.status(200).json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = hashToken(resetToken);
        user.resetPasswordTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await user.save();

        const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}&id=${user._id}`;
        await sendEmail(
            email,
            'Password Reset Request',
            `<h2>Password Reset</h2>
             <p>You requested a password reset. Click below to reset your password. This link expires in 1 hour.</p>
             <a href="${resetUrl}">${resetUrl}</a>
             <p>If you did not request this, please ignore this email.</p>`
        );

        res.status(200).json({ success: true, message: 'If that email is registered, a reset link has been sent.' });

    } catch (e) {
        console.log(e);
        res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
    }
}

// ─── Reset Password ───────────────────────────────────────────────────────────

const resetPassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        const { token, id: userId } = req.query;

        const user = await User.findById(userId);
        const resetTokenHash = hashToken(token);
        if (!user || user.resetPasswordToken !== resetTokenHash || user.resetPasswordTokenExpiry < new Date()) {
            return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordTokenExpiry = undefined;
        user.refreshTokenHash = null;
        await user.save();

        res.status(200).json({ success: true, message: 'Password reset successful! You can now login with your new password.' });

    } catch (e) {
        console.log(e);
        res.status(500).json({ success: false, message: 'Password reset failed. Please try again.' });
    }
}

module.exports = { loginUser, registerUser, logoutUser, refreshToken, verifyEmail, forgotPassword, resetPassword }