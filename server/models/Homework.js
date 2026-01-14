const mongoose = require('mongoose');

const HomeworkSchema = new mongoose.Schema({
    title: { type: String, required: true },
    classroom: { type: String, required: true },
    targetGrade: { type: String, default: 'Tous' },
    targetPlayerIds: [String],
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
    
    // Miroir Drive (Même logique que ScanSession)
    driveFolderId: String,        // Racine du devoir
    subjectFolderId: String,      // Dossier SUJET
    copiesFolderId: String,       // Dossier COPIES
    correctionsFolderId: String,  // Dossier CORRECTIONS

    levels: { type: Array, default: [] },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Homework || mongoose.model('Homework', HomeworkSchema);