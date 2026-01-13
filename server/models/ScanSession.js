const mongoose = require('mongoose');

const ScanSessionSchema = new mongoose.Schema({
    title: { type: String, default: "" }, 
    classroom: { type: String, required: true },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' }, // Le dossier où il est classé
    
    // IDs des dossiers physiques sur Google Drive
    driveFolderId: String,        // Racine (ex: "Dictée 12/01")
    subjectFolderId: String,      // Sous-dossier "Sujet"
    copiesFolderId: String,       // Sous-dossier "Copies"
    correctionsFolderId: String,  // Sous-dossier "Corrections"

    // Listes des IDs de fichiers Drive (photos)
    subjectUrls: { type: [String], default: [] }, // Questions et documents
    copyUrls: { type: [String], default: [] },    // Copies élèves
    
    teacherInstruction: { type: String, default: "" }, 
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.ScanSession || mongoose.model('ScanSession', ScanSessionSchema);