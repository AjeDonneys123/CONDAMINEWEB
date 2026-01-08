const mongoose = require('mongoose');

const GameLevelSchema = new mongoose.Schema({
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
    title: String,
    targetGrade: String,
    classroom: String,
    questions: Array
});

module.exports = mongoose.model('GameLevel', GameLevelSchema);