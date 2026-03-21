const jwt = require('jsonwebtoken')
const { isBlacklisted } = require('../utils/tokenBlacklist')

const authMiddleware = async (req, res, next) => {
    const header = req.headers['authorization']
    // console.log(header);
    const token = header && header.split(" ")[1]

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access Denied! Please Register/Login to continue'
        })
    }

    // Check if token is blacklisted in Redis
    const blacklisted = await isBlacklisted(token);
    if (blacklisted) {
        return res.status(401).json({
            success: false,
            message: 'Token has been revoked. Please login again'
        })
    }

    // console.log('auth middleware is called');
    try {
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET_KEY)
        req.userInfo = decodedToken
        next();

    } catch (error) {
        const message = error.name === 'TokenExpiredError'
            ? 'Token has expired. Please login again'
            : 'Invalid token. Please login again';
        return res.status(401).json({
            success: false,
            message
        })
    }
}

const adminMiddleware = (req, res, next) => {
    try {
        const { role } = req.userInfo;
        if (role === 'admin') { next(); }
        else {
            res.status(403).json({
                success: false,
                message: 'You need admin access for accessing this page!'
            })
        }
    } catch (e) {
        res.status(500).json({
            success: false,
            message: 'Something went wrong! Either your token  expired or you are not logged in. Please login again or register first!'
        })
    }
}
module.exports = { authMiddleware, adminMiddleware }