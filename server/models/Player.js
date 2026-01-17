const mongoose = require('mongoose');
// Gardé uniquement pour la migration initiale
const PlayerSchema = new mongoose.Schema({
    firstName: String, lastName: String, classroom: String, spellingMistakes: Array
}, { collection: 'players' });
module.exports = mongoose.models.Player || mongoose.model('Player', PlayerSchema);