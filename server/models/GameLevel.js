const mongoose = require('mongoose');
const GameLevelSchema = new mongoose.Schema({
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
    title: String,
    targetGrade: String,
    classroom: String,
    questions: Array
}, { collection: 'gamelevels' }); // On choisit la version sans underscore

module.exports = mongoose.models.GameLevel || mongoose.model('GameLevel', GameLevelSchema);