const mongoose = require('mongoose')


const MONGO_URI = process.env.MONGO_URI
const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI)
        console.log(`MongoDB connected successfully`);
    } catch (e) {
        console.error('MongoDB connection failed:', e.message);
        throw e;
    }
}

module.exports = connectDB