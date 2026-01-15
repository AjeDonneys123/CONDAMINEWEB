const mongoose = require('mongoose');
const ChapterSchema = new mongoose.Schema({
    title: String, subject: String, classroom: String, isArchived: { type: Boolean, default: false }
}, { collection: 'chapters' });
module.exports = mongoose.models.Chapter || mongoose.model('Chapter', ChapterSchema);