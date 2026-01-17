const mongoose = require('mongoose');
const HomeworkSchema = new mongoose.Schema({
    title: { type: String, required: true },
    classroom: String,
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
    levels: Array, // [{instruction, aiHints, attachmentUrls}]
    date: { type: Date, default: Date.now }
}, { collection: 'homeworks' });
module.exports = mongoose.models.Homework || mongoose.model('Homework', HomeworkSchema);