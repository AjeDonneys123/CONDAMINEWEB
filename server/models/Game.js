const mongoose = require('mongoose');
/**
 * SECTION 10 : LES JEUX (Conteneurs)
 * Définit un jeu global (ex: "La Rome Antique") qui contient des niveaux.
 */
const GameSchema = new mongoose.Schema({
    title: { type: String, required: true },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
    type: { type: String, enum: ['zombie', 'starship'], default: 'zombie' },
    createdAt: { type: Date, default: Date.now }
}, { collection: 'games' });
module.exports = mongoose.models.Game || mongoose.model('Game', GameSchema);