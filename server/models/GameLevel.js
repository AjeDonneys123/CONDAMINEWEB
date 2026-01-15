const mongoose = require('mongoose');
const GameLevelSchema = new mongoose.Schema({
    chapterId: mongoose.Schema.Types.ObjectId,
    title: String,
    classroom: String,
    questions: Array
}, { collection: 'gamelevels' });
module.exports = mongoose.models.GameLevel || mongoose.model('GameLevel', GameLevelSchema);