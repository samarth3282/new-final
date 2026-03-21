const mongoose = require('mongoose');

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
    gender:      { type: String, enum: ['male', 'female', 'other', ''], default: '' },
    address: {
        street:  { type: String, default: '' },
        city:    { type: String, default: '' },
        state:   { type: String, default: '' },
        pincode: { type: String, default: '' }
    },

    // ── Patient-specific fields ───────────────────────────────────────────────
    // Unique identifier assigned at registration (e.g. PAT-3F8A2C1B)
    patientId: {
        type:   String,
        unique: true,
        sparse: true   // null for non-patient roles — not subject to unique index
    },
    // Accumulated summary of all the patient's chatbot interactions (lifetime)
    completeSummary: { type: String, default: '' },
    // Summary of the patient's most-recent / ongoing chatbot conversation
    currentSummary:  { type: String, default: '' },
    // Whether the patient consents to share their details with hospitals
    // null = not yet answered, true = yes, false = no
    shareWithHospital: { type: Boolean, default: null },

    // ── ASHA-worker-specific fields ───────────────────────────────────────────
    ashaCertificateId: { type: String, trim: true, default: '' },
    district:          { type: String, trim: true, default: '' },
    village:           { type: String, trim: true, default: '' },

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