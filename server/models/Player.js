const mongoose = require('mongoose');
const PlayerSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    classroom: String,
    email: { type: String, default: "" },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    spellingMistakes: { type: Array, default: [] }
}, { collection: 'players' }); // Force le nom en minuscules

module.exports = mongoose.models.Player || mongoose.model('Player', PlayerSchema);