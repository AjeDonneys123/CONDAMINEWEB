const mongoose = require('mongoose');

const HomeworkSchema = new mongoose.Schema({
    title: String,
    classroom: String,
    targetGrade: String,
    targetPlayerIds: [String],
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
    levels: Array,
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Homework', HomeworkSchema);