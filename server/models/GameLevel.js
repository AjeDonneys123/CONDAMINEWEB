const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
    q: String,
    options: [String],
    a: Number
}, { _id: false });

const EducationalAssetSchema = new mongoose.Schema({
    sheetUrl: { type: String, default: "" }, 
    videoUrl: { type: String, default: "" }
}, { _id: false });

const LevelStructureSchema = new mongoose.Schema({
    name: { type: String, default: "Niveau 1" },
    intro: { type: EducationalAssetSchema, default: () => ({}) },
    questions: [QuestionSchema]
}, { _id: false });

const GameLevelSchema = new mongoose.Schema({
    title: { type: String, required: true },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    
    classroom: String,
    targetClassrooms: [String], 
    assignedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    isAllClass: { type: Boolean, default: true },

    levels: { type: [LevelStructureSchema], default: [] },
    
    questions: { type: [QuestionSchema], default: [] }, // Legacy

    globalIntro: { type: EducationalAssetSchema, default: () => ({}) },

    isArchived: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
}, { 
    collection: 'gamelevels',
    strict: false, // 🚀 FORCE L'ENREGISTREMENT DE TOUT
    minimize: false // GARDE LES OBJETS VIDES SI BESOIN
});

// Hack pour forcer la recompilation du modèle si le fichier change
if (mongoose.models.GameLevel) {
    delete mongoose.models.GameLevel;
}

module.exports = mongoose.model('GameLevel', GameLevelSchema);
