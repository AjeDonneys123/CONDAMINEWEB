const mongoose = require('mongoose');
const SubmissionSchema = new mongoose.Schema({
    playerId: mongoose.Schema.Types.ObjectId,
    homeworkId: mongoose.Schema.Types.ObjectId,
    feedback: String,
    grade: String,
    createdAt: { type: Date, default: Date.now }
}, { collection: 'submissions' });
module.exports = mongoose.models.Submission || mongoose.model('Submission', SubmissionSchema);