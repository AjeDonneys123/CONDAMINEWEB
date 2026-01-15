const mongoose = require('mongoose');

const HomeworkSchema = new mongoose.Schema({
    title: { type: String, required: true },
    classroom: { type: String, required: true },
    targetGrade: String,
    targetPlayerIds: [String],
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true },
    driveFolderId: String,
    levels: Array,
    date: { type: Date, default: Date.now }
}, { collection: 'homeworks' });

// OPTIMISATION : Indexation pour l'alignement miroir
HomeworkSchema.index({ classroom: 1 });
HomeworkSchema.index({ chapterId: 1 });

module.exports = mongoose.models.Homework || mongoose.model('Homework', HomeworkSchema);