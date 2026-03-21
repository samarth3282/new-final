const mongoose = require('mongoose');

/**
 * Pre-authorized registry for ASHA workers and admins.
 * Each record is seeded by the system. A user can only register as asha/admin
 * if their submitted workerCode + lastName match an unused record for that role.
 */
const PreAuthorizedSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ['asha', 'admin'],
        required: true
    },
    // The unique ID issued by the system (e.g. ASHA001, ADM001)
    workerCode: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    // Pre-set last name — must match what the registrant enters
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    // Becomes true once successfully used — prevents reuse
    isUsed: {
        type: Boolean,
        default: false
    },
    // Reference to the User who claimed this slot
    usedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('PreAuthorized', PreAuthorizedSchema);
