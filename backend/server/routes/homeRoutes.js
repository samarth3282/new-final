const express = require('express');
const { authMiddleware } = require('../middlewares/authMiddleware');
const User = require('../Models/User');
const router = express.Router();

// Returns the full user profile (excluding sensitive auth fields)
router.get('/home', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.userInfo;
        const user = await User.findById(userId).select(
            '-password -verificationToken -verificationTokenExpiry -resetPasswordToken -resetPasswordTokenExpiry -refreshTokenHash'
        );
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
        ).select('-password -verificationToken -verificationTokenExpiry -resetPasswordToken -resetPasswordTokenExpiry -refreshTokenHash');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, user });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;