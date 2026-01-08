const mongoose = require('mongoose');

const ChapterSchema = new mongoose.Schema({
    title: { type: String, default: '' },
    subject: { type: String, required: true }, // H, G ou E
    isArchived: { type: Boolean, default: false },
    classroom: { type: String, required: true }
});

module.exports = mongoose.model('Chapter', ChapterSchema);