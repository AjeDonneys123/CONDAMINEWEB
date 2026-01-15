const mongoose = require('mongoose');
const ScanSessionSchema = new mongoose.Schema({
    title: String,
    classroom: String,
    chapterId: mongoose.Schema.Types.ObjectId,
    subjectUrls: [String],
    copyUrls: [String]
}, { collection: 'scansessions' });
module.exports = mongoose.models.ScanSession || mongoose.model('ScanSession', ScanSessionSchema);