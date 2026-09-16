const mongoose = require('mongoose');
const SubmissionSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    homeworkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Homework' },
    content: String,
    draftContent: { type: String, default: '' },
    aiNotes: { type: String, default: '' },
    aiConversationLog: { type: String, default: '' },
    timeSpentSeconds: { type: Number, default: 0 },
    attemptsCount: { type: Number, default: 1 },
    mode: { type: String, default: 'docs' },
    feedback: String,
    grade: String,
    antiCheat: { type: Object, default: {} },
    createdAt: { type: Date, default: Date.now }
}, { collection: 'submissions' });
module.exports = mongoose.models.Submission || mongoose.model('Submission', SubmissionSchema);
