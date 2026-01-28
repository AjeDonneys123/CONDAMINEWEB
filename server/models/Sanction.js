const mongoose = require('mongoose');

/**
 * ⚖️ MODÈLE SANCTION
 * Historique des croix et punitions pour le suivi administratif.
 */
const SanctionSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
    type: { type: String, enum: ['CROSS', 'PUNISHMENT', 'REDEEMED'], required: true },
    reason: { type: String },
    level: { type: Number }, // ex: 1 pour première croix, 3 pour déclenchement punition
    date: { type: Date, default: Date.now }
}, { collection: 'sanctions' });

module.exports = mongoose.models.Sanction || mongoose.model('Sanction', SanctionSchema);
