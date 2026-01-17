const mongoose = require('mongoose');
const SubmissionSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    homeworkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Homework' },
    content: String,
    feedback: String,
    grade: String,
    createdAt: { type: Date, default: Date.now }
}, { collection: 'submissions' });
module.exports = mongoose.models.Submission || mongoose.model('Submission', SubmissionSchema);