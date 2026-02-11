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
    subject: { type: String, default: "GÉNÉRAL" }, 
    isTestGame: { type: Boolean, default: false },

    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    targetClassrooms: [String], 
    assignedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    isAllClass: { type: Boolean, default: true },

    // --- LE MIROIR STUDIO ---
    // Ces champs permettent à Julian de voir exactement ce que le prof a créé
    scenes: { type: Array, default: [] }, 
    generatedCode: { type: String, default: "" },
    
    levels: { type: [LevelStructureSchema], default: [] },
    globalIntro: { type: EducationalAssetSchema, default: () => ({}) },

    createdAt: { type: Date, default: Date.now }
}, { 
    collection: 'gamelevels',
    strict: false 
});

if (mongoose.models.GameLevel) delete mongoose.models.GameLevel;
module.exports = mongoose.model('GameLevel', GameLevelSchema);
