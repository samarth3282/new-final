const express = require('express');
const { authMiddleware, adminMiddleware } = require('../middlewares/authMiddleware')
const router = express.Router();

router.get('/admin', authMiddleware, adminMiddleware, (req, res) => {
    res.json({
        message: 'Welcome to Admin Page'
    })
})

module.exports = router