const mongoose = require('mongoose');

const ScanSessionSchema = new mongoose.Schema({
    title: { type: String, default: "" }, 
    classroom: { type: String, required: true },
    driveFolderId: String,
    questionUrls: { type: [String], default: [] }, // Photos du sujet
    copyUrls: { type: [String], default: [] },     // Photos des copies
    teacherInstruction: { type: String, default: "" }, 
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.ScanSession || mongoose.model('ScanSession', ScanSessionSchema);