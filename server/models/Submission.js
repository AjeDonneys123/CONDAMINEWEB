const mongoose = require('mongoose');

const SubmissionSchema = new mongoose.Schema({
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    driveFileId: String, 
    originalTranscription: String,
    correctedTranscription: String,
    feedback: String,
    grade: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Submission', SubmissionSchema);