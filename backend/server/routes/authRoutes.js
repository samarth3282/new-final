const express = require('express');
const {
    registerUser,
    loginUser,
    logoutUser,
    refreshToken,
    verifyEmail,
    forgotPassword,
    resetPassword
} = require('../controllers/authController')
const { loginLimiter, registerLimiter, forgotPasswordLimiter } = require('../middlewares/rateLimitMiddleware')
const { validateRegister, validateLogin, validateForgotPassword, validateResetPassword } = require('../middlewares/validateMiddleware')
const router = express.Router();

router.post('/register', registerLimiter, validateRegister, registerUser)
router.post('/login', loginLimiter, validateLogin, loginUser)
router.post('/logout', logoutUser)
router.post('/refresh-token', refreshToken)
router.get('/verify-email', verifyEmail)
router.post('/forgot-password', forgotPasswordLimiter, validateForgotPassword, forgotPassword)
router.post('/reset-password', validateResetPassword, resetPassword)

module.exports = router