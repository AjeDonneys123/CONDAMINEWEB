const mongoose = require('mongoose');
const ChapterSchema = new mongoose.Schema({
    title: { type: String, default: '' },
    subject: { type: String, required: true },
    isArchived: { type: Boolean, default: false },
    classroom: { type: String, required: true },
    driveFolderId: String
});
module.exports = mongoose.models.Chapter || mongoose.model('Chapter', ChapterSchema);