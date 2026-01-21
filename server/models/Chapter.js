const mongoose = require('mongoose');

const ChapterSchema = new mongoose.Schema({
    title: { type: String, required: true },
    section: { type: String, default: "Général" }, 
    
    // Classe spécifique (ex: "6A")
    classroom: String, 
    
    // NOUVEAU : Niveau partagé (ex: "6" pour toutes les 6èmes, "1" pour toutes les 1ères)
    sharedLevel: String, 

    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    isArchived: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
}, { collection: 'chapters' });

module.exports = mongoose.models.Chapter || mongoose.model('Chapter', ChapterSchema);