const mongoose = require('mongoose');

/**
 * 🎮 MODÈLE GAME LEVEL V2 (Harmonisé avec Homework)
 * Ajout des champs de ciblage (Classes, Élèves, Prof) pour la distribution.
 */
const GameLevelSchema = new mongoose.Schema({
    title: { type: String, required: true },
    
    // Structure & Propriété
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },

    // Ciblage (Distribution)
    classroom: String, // Gardé pour compatibilité legacy
    targetClassrooms: [String], 
    assignedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    isAllClass: { type: Boolean, default: true },

    // Contenu
    questions: [{
        q: String,          // Énoncé
        options: [String],  // [Rep A, Rep B, Rep C, Rep D]
        a: Number           // Index bonne réponse (0-3)
    }],

    isArchived: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
}, { collection: 'gamelevels' });

module.exports = mongoose.models.GameLevel || mongoose.model('GameLevel', GameLevelSchema);