require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/authRoutes')
const connectDB = require('./db/db')
const homeRoutes = require('./routes/homeRoutes')
const adminRoutes = require('./routes/adminRoutes')
const { connectRedis } = require('./utils/tokenBlacklist')

const PORT = process.env.PORT || 3000

const createApp = () => {
    const app = express()

    // Trust Render's reverse proxy for rate-limiting
    app.set('trust proxy', 1)

    // Security middleware
    app.use(helmet())

    const allowedOrigins = [
        process.env.CLIENT_URL      || 'http://localhost:5173',  // main_frontend
        process.env.AUTH_CLIENT_URL || 'http://localhost:5174',  // auth_frontend
    ];
    app.use(cors({
        origin: (origin, callback) => {
            // Allow same-origin (no Origin header) and explicitly listed origins
            if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
            callback(new Error(`CORS: origin ${origin} not allowed`));
        },
        credentials: true
    }))

    app.use(express.json())
    app.use(cookieParser())

    app.use('/api', authRoutes)
    app.use('/api', homeRoutes)
    app.use('/api', adminRoutes)

    // Centralized error handler
    app.use((err, req, res, next) => {
        console.error('Unhandled error:', err)
        res.status(err.status || 500).json({
            success: false,
            message: err.message || 'Internal server error'
        })
    })

    return app
}

const startServer = async () => {
    try {
        await connectDB()
        await connectRedis()
        const app = createApp()

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running on port ${PORT}`)
        })
    } catch (e) {
        console.error('Failed to start server:', e.message)
        process.exit(1)
    }
}

if (require.main === module) {
    startServer()
}

module.exports = { createApp, startServer }