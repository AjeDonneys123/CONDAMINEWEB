const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    classroom: String,
    spellingMistakes: { type: Array, default: [] }
});

module.exports = mongoose.model('Player', PlayerSchema);