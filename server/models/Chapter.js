const mongoose = require('mongoose');
const ChapterSchema = new mongoose.Schema({
    title: { type: String, required: true },
    subject: String,
    isArchived: { type: Boolean, default: false },
    classroom: String,
    driveFolderId: String
}, { collection: 'chapters' });
module.exports = mongoose.models.Chapter || mongoose.model('Chapter', ChapterSchema);