const mongoose = require('mongoose');

const HomeworkSchema = new mongoose.Schema({
    title: { type: String, required: true },
    
    // NOUVEAU : Mode Punition
    isPunishment: { type: Boolean, default: false },

    // Ancien champ (gardé pour compatibilité)
    classroom: String,
    
    // Liste des classes ciblées
    targetClassrooms: [String], 

    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    
    levels: [{
        instruction: String,
        instructionUrls: [String],
        aiHints: String,
        attachmentUrls: [String]
    }],

    // Élèves assignés (pour les punitions, c'est ici qu'ils atterrissent dynamiquement)
    assignedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    
    // Si true, c'est pour toute(s) la/les classe(s) ciblée(s) (SAUF SI PUNITION)
    isAllClass: { type: Boolean, default: true },
    
    date: { type: Date, default: Date.now }
}, { collection: 'homeworks' });

module.exports = mongoose.models.Homework || mongoose.model('Homework', HomeworkSchema);