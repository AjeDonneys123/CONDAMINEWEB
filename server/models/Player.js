const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    classroom: String,
    email: { type: String, default: "" },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }, // Lié au prof
    spellingMistakes: { type: Array, default: [] }
});

module.exports = mongoose.model('Player', PlayerSchema);