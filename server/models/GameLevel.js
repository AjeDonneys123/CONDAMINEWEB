const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
    q: String,
    options: [String],
    a: Number
}, { _id: false });

// NOUVEAU : Schéma pour les ressources pédagogiques (Fiche + Vidéo)
const EducationalAssetSchema = new mongoose.Schema({
    sheetUrl: { type: String, default: "" }, // URL de la Fiche (Image/PDF)
    videoUrl: { type: String, default: "" }  // Lien Vidéo (YouTube/Drive)
}, { _id: false });

const LevelStructureSchema = new mongoose.Schema({
    name: { type: String, default: "Niveau 1" },
    intro: { type: EducationalAssetSchema, default: {} }, // Ressource spécifique au niveau
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

    // RESSOURCES GLOBALES (La "Super Fiche")
    globalIntro: { type: EducationalAssetSchema, default: {} },

    levels: { type: [LevelStructureSchema], default: [] },
    questions: { type: [QuestionSchema], default: [] }, // Legacy

    isArchived: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
}, { collection: 'gamelevels' });

module.exports = mongoose.models.GameLevel || mongoose.model('GameLevel', GameLevelSchema);
