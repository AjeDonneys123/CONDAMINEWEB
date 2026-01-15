const mongoose = require('mongoose');
const GameLevelSchema = new mongoose.Schema({
    title: String, classroom: String, chapterId: mongoose.Schema.Types.ObjectId, questions: Array
}, { collection: 'gamelevels' });
module.exports = mongoose.models.GameLevel || mongoose.model('GameLevel', GameLevelSchema);