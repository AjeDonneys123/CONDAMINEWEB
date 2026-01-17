const mongoose = require('mongoose');
/**
 * SECTION 14 : LE CARNET D'ORTHOGRAPHE
 * Suivi long terme des erreurs de chaque élève.
 */
const MistakesBookSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    wrong: String,
    correct: String,
    context: String, // Phrase où l'erreur a été faite
    date: { type: Date, default: Date.now }
}, { collection: 'mistakes' });
module.exports = mongoose.models.MistakesBook || mongoose.model('MistakesBook', MistakesBookSchema);