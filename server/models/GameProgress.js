const mongoose = require('mongoose');
const GameProgressSchema = new mongoose.Schema({
    studentId: mongoose.Schema.Types.ObjectId,
    gameId: String,
    levelReached: { type: Number, default: 0 },
    lastScore: Number
}, { collection: 'gameprogress' });
module.exports = mongoose.models.GameProgress || mongoose.model('GameProgress', GameProgressSchema);