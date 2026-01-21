const mongoose = require('mongoose');

const HomeworkSchema = new mongoose.Schema({
    title: { type: String, required: true },
    
    // Ancien champ (gardé pour compatibilité)
    classroom: String,
    
    // NOUVEAU : Liste des classes ciblées (ex: ["4A", "4B"])
    targetClassrooms: [String], 

    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    
    levels: [{
        instruction: String,
        instructionUrls: [String],
        aiHints: String,
        attachmentUrls: [String]
    }],

    // Élèves spécifiques (ex: PPRE, Soutien)
    assignedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    
    // Si true, c'est pour toute(s) la/les classe(s) ciblée(s)
    isAllClass: { type: Boolean, default: true },
    
    date: { type: Date, default: Date.now }
}, { collection: 'homeworks' });

module.exports = mongoose.models.Homework || mongoose.model('Homework', HomeworkSchema);