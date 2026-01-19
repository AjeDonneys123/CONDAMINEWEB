const mongoose = require('mongoose');

const HomeworkSchema = new mongoose.Schema({
    title: { type: String, required: true },
    classroom: String,
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    
    levels: [{
        instruction: String,
        instructionUrls: [String], // NOUVEAU : Images de la consigne
        aiHints: String,
        attachmentUrls: [String] // Images/Docs de travail
    }],

    assignedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    isAllClass: { type: Boolean, default: true },
    
    date: { type: Date, default: Date.now }
}, { collection: 'homeworks' });

module.exports = mongoose.models.Homework || mongoose.model('Homework', HomeworkSchema);