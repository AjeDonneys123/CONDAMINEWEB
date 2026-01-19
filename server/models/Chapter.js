const mongoose = require('mongoose');

const ChapterSchema = new mongoose.Schema({
    title: { type: String, required: true },
    
    // La "Section" est libre (créée par le prof), remplace l'ancienne logique "Matière Admin"
    section: { type: String, default: "Général" }, 
    
    // Gardé pour compatibilité temporaire, mais moins utilisé
    subject: { type: String }, 
    
    classroom: String, 
    driveFolderId: String,
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    
    // [NOUVEAU] Gestion d'archivage
    isArchived: { type: Boolean, default: false },
    
    createdAt: { type: Date, default: Date.now }
}, { collection: 'chapters' });

module.exports = mongoose.models.Chapter || mongoose.model('Chapter', ChapterSchema);