const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    classroom: String,
    email: { type: String, default: "" },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    spellingMistakes: { type: Array, default: [] }
}, { 
    collection: 'players',
    timestamps: { createdAt: 'created_at' }
});

// OPTIMISATION : Accélère le chargement de la liste des élèves (US #15)
PlayerSchema.index({ classroom: 1 });
PlayerSchema.index({ lastName: 1, firstName: 1 });

module.exports = mongoose.models.Player || mongoose.model('Player', PlayerSchema);