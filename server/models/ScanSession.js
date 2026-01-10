const mongoose = require('mongoose');

const ScanSessionSchema = new mongoose.Schema({
    title: { type: String, default: "" }, 
    classroom: { type: String, required: true },
    driveFolderId: String,
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' }, // Lien vers le dossier Activité
    questionUrls: { type: [String], default: [] },
    copyUrls: { type: [String], default: [] },
    teacherInstruction: { type: String, default: "" }, 
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.ScanSession || mongoose.model('ScanSession', ScanSessionSchema);