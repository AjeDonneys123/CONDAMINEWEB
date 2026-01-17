const mongoose = require('mongoose');
/**
 * SECTION 13 : JEUX DES ÉLÈVES (Progression)
 * Sait quel élève a débloqué quel niveau dans quel jeu.
 */
const GameProgressSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game' },
    unlockedLevel: { type: Number, default: 1 },
    isCompleted: { type: Boolean, default: false }
}, { collection: 'gameprogress' });
module.exports = mongoose.models.GameProgress || mongoose.model('GameProgress', GameProgressSchema);