/**
 * One-time seed script — inserts 5 ASHA workers + 5 admins into the
 * PreAuthorized collection. Run once:
 *   node db/seed.js
 *
 * Safe to re-run: uses insertMany with ordered:false and ignores duplicate-key errors.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const PreAuthorized = require('../Models/PreAuthorized');

const SEED_DATA = [
    // ── ASHA Workers ────────────────────────────────────────────────────────
    { role: 'asha',  workerCode: 'ASHA001', lastName: 'Sharma'  },
    { role: 'asha',  workerCode: 'ASHA002', lastName: 'Patel'   },
    { role: 'asha',  workerCode: 'ASHA003', lastName: 'Verma'   },
    { role: 'asha',  workerCode: 'ASHA004', lastName: 'Gupta'   },
    { role: 'asha',  workerCode: 'ASHA005', lastName: 'Singh'   },

    // ── Admins ───────────────────────────────────────────────────────────────
    { role: 'admin', workerCode: 'ADM001',  lastName: 'Mehta'   },
    { role: 'admin', workerCode: 'ADM002',  lastName: 'Rao'     },
    { role: 'admin', workerCode: 'ADM003',  lastName: 'Iyer'    },
    { role: 'admin', workerCode: 'ADM004',  lastName: 'Nair'    },
    { role: 'admin', workerCode: 'ADM005',  lastName: 'Joshi'   },
];

(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected');

        const result = await PreAuthorized.insertMany(SEED_DATA, { ordered: false });
        console.log(`✅ Seeded ${result.length} pre-authorized records`);
    } catch (err) {
        if (err.code === 11000 || (err.writeErrors && err.writeErrors.length)) {
            console.log('⚠️  Some records already exist (skipped duplicates) — seed complete');
        } else {
            console.error('❌ Seed failed:', err.message);
        }
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected');
    }
})();
