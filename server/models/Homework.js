const mongoose = require('mongoose');
const HomeworkSchema = new mongoose.Schema({
    title: { type: String, required: true },
    classroom: { type: String, required: true },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
    driveFolderId: String,
    levels: Array,
    date: { type: Date, default: Date.now }
}, { collection: 'homeworks' });
module.exports = mongoose.models.Homework || mongoose.model('Homework', HomeworkSchema);