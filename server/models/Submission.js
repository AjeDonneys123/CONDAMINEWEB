const mongoose = require('mongoose');
const SubmissionSchema = new mongoose.Schema({
    playerId: mongoose.Schema.Types.ObjectId, homeworkId: mongoose.Schema.Types.ObjectId, levelIndex: Number,
    originalTranscription: String, feedback: String, grade: String, createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.models.Submission || mongoose.model('Submission', SubmissionSchema);