const mongoose = require('mongoose');
const ChapterSchema = new mongoose.Schema({
    title: { type: String, required: true },
    subject: { type: String, default: "H" },
    isArchived: { type: Boolean, default: false },
    classroom: { type: String, required: true },
    driveFolderId: String,
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }
}, { collection: 'chapters' });
module.exports = mongoose.models.Chapter || mongoose.model('Chapter', ChapterSchema);