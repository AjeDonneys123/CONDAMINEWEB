const mongoose = require('mongoose');

const ChapterSchema = new mongoose.Schema({
    title: { type: String, required: true },
    subject: { type: String, required: true }, // ex: "HISTOIRE"
    isArchived: { type: Boolean, default: false },
    classroom: { type: String, required: true },
    driveFolderId: String,
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }
}, { collection: 'chapters' });

// OPTIMISATION : Indexation pour recherche rapide par classe et par prof
ChapterSchema.index({ classroom: 1 });
ChapterSchema.index({ teacherId: 1 });

module.exports = mongoose.models.Chapter || mongoose.model('Chapter', ChapterSchema);