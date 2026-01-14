const mongoose = require('mongoose');
const HomeworkSchema = new mongoose.Schema({
    title: String,
    classroom: String,
    targetGrade: String,
    targetPlayerIds: [String],
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
    driveFolderId: String,
    levels: Array,
    date: { type: Date, default: Date.now }
}, { collection: 'homeworks' });

module.exports = mongoose.models.Homework || mongoose.model('Homework', HomeworkSchema);