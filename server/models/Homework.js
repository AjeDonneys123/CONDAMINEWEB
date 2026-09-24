const mongoose = require('mongoose');

const HomeworkSchema = new mongoose.Schema({
    title: { type: String, required: true },
    
    // NOUVEAU : Mode Punition
    isPunishment: { type: Boolean, default: false },

    // NOUVEAU : Matière (String simple pour l'affichage élève)
    subject: { type: String, default: "Général" },

    // NOUVEAU : Mode de devoir ('docs' pour multi-questions/documents ou 'redaction' pour sujet libre/développement)
    mode: { type: String, enum: ['docs', 'redaction'], default: 'docs' },
    promptTopic: { type: String, default: '' },
    minTimeMinutes: { type: Number, default: 25 },

    // Ancien champ (gardé pour compatibilité)
    classroom: String,
    
    // Liste des classes ciblées
    targetClassrooms: [String], 

    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    
    levels: [{
        instruction: String,
        instructionUrls: [String],
        aiHints: String,
        aiHintUrls: [String],
        compactCorrection: mongoose.Schema.Types.Mixed,
        compactCorrectionSourceHash: String,
        compactCorrectionGeneratedAt: String,
        compactCorrectionError: String,
        maxPoints: Number,
        dnbSection: String,
        dnbSubject: String,
        attachmentUrls: [String]
    }],

    assignedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    isAllClass: { type: Boolean, default: true },
    isEnabled: { type: Boolean, default: true },
    didakbotUrl: { type: String, default: '' },
    
    date: { type: Date, default: Date.now }
}, { collection: 'homeworks' });

module.exports = mongoose.models.Homework || mongoose.model('Homework', HomeworkSchema);
