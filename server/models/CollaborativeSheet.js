const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
    authorId: { type: mongoose.Schema.Types.ObjectId, default: null },
    authorName: { type: String, required: true, trim: true },
    authorRole: { type: String, enum: ['student', 'teacher'], default: 'student' },
    text: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now }
});

const ContributionSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    studentName: { type: String, required: true, trim: true },
    studentFirstName: { type: String, default: '', trim: true },
    text: { type: String, required: true, trim: true },
    html: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    comments: { type: [CommentSchema], default: [] }
});

const ParagraphSchema = new mongoose.Schema({
    paragraphId: { type: String, required: true },
    baseText: { type: String, default: '' },
    baseHtml: { type: String, default: '' },
    order: { type: Number, default: 0 },
    authorRole: { type: String, enum: ['teacher', 'student'], default: 'teacher' },
    createdById: { type: mongoose.Schema.Types.ObjectId, default: null },
    createdByName: { type: String, default: '' },
    baseComments: { type: [CommentSchema], default: [] },
    contributions: { type: [ContributionSchema], default: [] }
});

const CollaborativeSheetSchema = new mongoose.Schema({
    moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningModule', required: true, index: true },
    stepId: { type: String, required: true, index: true },
    classroom: { type: String, default: '', index: true },
    paragraphs: { type: [ParagraphSchema], default: [] },
    updatedAt: { type: Date, default: Date.now }
}, { collection: 'collaborative_sheets' });

CollaborativeSheetSchema.index({ moduleId: 1, stepId: 1, classroom: 1 }, { unique: true });

module.exports = mongoose.models.CollaborativeSheet || mongoose.model('CollaborativeSheet', CollaborativeSheetSchema);
