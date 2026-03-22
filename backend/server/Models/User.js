const mongoose = require('mongoose');

const RelativeSchema = new mongoose.Schema({
    patientId:    { type: String, required: true, trim: true },
    relationship: { type: String, required: true, trim: true },
}, { _id: true });

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['patient', 'asha', 'admin'],
        default: 'patient'
    },

    // ── Common profile fields ─────────────────────────────────────────────────
    firstName:   { type: String, trim: true, default: '' },
    lastName:    { type: String, trim: true, default: '' },
    phone:       { type: String, trim: true, default: '' },
    dateOfBirth: { type: Date },
    gender:      { type: String, enum: ['male', 'female', 'other', 'prefer_not', ''], default: '' },
    age:         { type: Number, default: null },
    coordinates: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null }
    },
    address: {
        street:  { type: String, default: '' },
        city:    { type: String, default: '' },
        state:   { type: String, default: '' },
        pincode: { type: String, default: '' }
    },

    // ── Health measurement fields ─────────────────────────────────────────────
    country:    { type: String, trim: true, default: '' },
    height:     { type: Number, default: null },
    weight:     { type: Number, default: null },
    unitSystem: { type: String, enum: ['metric', 'imperial'], default: 'metric' },

    // ── Patient-specific fields ───────────────────────────────────────────────
    patientId: {
        type:   String,
        unique: true,
        sparse: true
    },
    completeSummary: { type: String, default: '' },
    currentSummary:  { type: String, default: '' },
    shareWithHospital: { type: Boolean, default: null },
    allergies:         [{ type: String, trim: true }],
    medicalHistory:    [{ type: String, trim: true }],
    currentMedication: [{ type: String, trim: true }],
    relatives:         [RelativeSchema],

    // ── ASHA-worker-specific fields ───────────────────────────────────────────
    ashaCertificateId: { type: String, trim: true, default: '' },
    district:          { type: String, trim: true, default: '' },
    village:           { type: String, trim: true, default: '' },
    patientsHandled:   { type: Number, default: 0 },
    leavesTaken:       { type: Number, default: 0 },
    rating:            { type: Number, default: 0, min: 0, max: 5 },

    // ── Admin-specific fields ─────────────────────────────────────────────────
    adminId:           { type: String, trim: true, default: '' },
    adminDistrict:     { type: String, trim: true, default: '' },
    govNotifications:  [{ type: String, trim: true }],
    govGuidelines:     [{ type: String, trim: true }],

    // ── Auth / token fields ───────────────────────────────────────────────────
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: String,
    verificationTokenExpiry: Date,
    resetPasswordToken: String,
    resetPasswordTokenExpiry: Date,
    refreshTokenHash: {
        type: String,
        default: null
    }
}, { timestamps: true })

module.exports = mongoose.model('User', UserSchema)