const mongoose = require('mongoose');
const ScanSessionSchema = new mongoose.Schema({
    title: { type: String, default: "" }, 
    classroom: { type: String, required: true },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' }, 
    driveFolderId: String,
    subjectFolderId: String,
    copiesFolderId: String,
    correctionsFolderId: String,
    subjectUrls: { type: [String], default: [] }, 
    copyUrls: { type: [String], default: [] },
    teacherInstruction: { type: String, default: "" }, 
    createdAt: { type: Date, default: Date.now }
}, { collection: 'scansessions' });

module.exports = mongoose.models.ScanSession || mongoose.model('ScanSession', ScanSessionSchema);