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
    examBonusPoints: { type: Number, default: 0 },
    mode: { type: String, default: 'docs' },
    learningEfficiency: {
        score: { type: Number, default: 0 },
        examBonusPoints: { type: Number, default: 0 },
        studentMessage: { type: String, default: '' },
        teacherSummary: { type: String, default: '' },
        substantialAttemptsCount: { type: Number, default: 0 },
        attemptsHistory: { type: Array, default: [] },
        attemptsEvaluation: { type: Array, default: [] },
        chatContainsAttempt1: { type: Boolean, default: false },
        draftWordCount: { type: Number, default: 0 },
        aiNotesWordCount: { type: Number, default: 0 },
        breakdown: { type: Object, default: {} }
    },
    feedback: String,
    grade: String,
    antiCheat: { type: Object, default: {} },
    createdAt: { type: Date, default: Date.now }
}, { collection: 'submissions' });
module.exports = mongoose.models.Submission || mongoose.model('Submission', SubmissionSchema);
