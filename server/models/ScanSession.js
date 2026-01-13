const mongoose = require('mongoose');

const ScanSessionSchema = new mongoose.Schema({
    title: { type: String, default: "" }, 
    classroom: { type: String, required: true },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' }, 
    
    driveFolderId: String,        // Racine
    subjectFolderId: String,      // Sous-dossier Sujet
    copiesFolderId: String,       // Sous-dossier Copies
    correctionsFolderId: String,  // Sous-dossier Corrections

    subjectUrls: { type: [String], default: [] }, 
    copyUrls: { type: [String], default: [] },
    
    teacherInstruction: { type: String, default: "" }, 
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.ScanSession || mongoose.model('ScanSession', ScanSessionSchema);