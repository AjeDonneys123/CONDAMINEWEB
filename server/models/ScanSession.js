const mongoose = require('mongoose');

const CorrectionResultSchema = new mongoose.Schema({
    originalUrl: String,
    studentName: String, // Identifié par IA
    transcription: String,
    mistakes: [String],
    appreciation: String, // Ajout Appréciation
    grade: String // A+, A, B, C
}, { _id: false });

const ScanSessionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    date: { type: Date, default: Date.now },
    teacherId: { type: String, required: true },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
    subjectUrls: [String],
    copyUrls: [String],
    aiInstructions: { type: String, default: "Corrige sévèrement la syntaxe." },
    corrections: [CorrectionResultSchema],
    status: { type: String, enum: ['OPEN', 'ARCHIVED'], default: 'OPEN' }
}, { collection: 'scansessions' });

module.exports = mongoose.models.ScanSession || mongoose.model('ScanSession', ScanSessionSchema);