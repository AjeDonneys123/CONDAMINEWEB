// @signatures: ProfModels, getModel
const mongoose = require('mongoose');

// --- SCHÉMAS UTILITAIRES ---

const SectionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    color: { type: String, default: '#6366f1' },
    scope: { type: String, enum: ['GLOBAL', 'LEVEL', 'CLASS'], default: 'GLOBAL' },
    target: { type: String, default: null },
    hiddenIn: { type: [String], default: [] } 
}, { _id: false });

const FrameSchema = new mongoose.Schema({
    url: String,
    name: String,
    type: { type: String, default: 'image' } 
}, { _id: false });

const ActionSchema = new mongoose.Schema({
    name: { type: String, default: "Nouvelle Action" },
    speed: { type: Number, default: 100 }, 
    frames: { type: [FrameSchema], default: [] }, 
    sounds: { type: [FrameSchema], default: [] }
}, { _id: false });

const ActorSchema = new mongoose.Schema({
    id: String, 
    name: String, 
    actions: { type: [ActionSchema], default: [] },
    currentAction: { type: String, default: "" },
    initialX: { type: Number, default: 50 }, 
    initialY: { type: Number, default: 50 }, 
    scale: { type: Number, default: 1 },
    direction: { type: Number, default: 0 },
    rotationStyle: { type: String, default: 'all' }
}, { _id: false });

const SceneSchema = new mongoose.Schema({
    name: String,
    backdrops: [{ name: String, url: String }],
    currentBackdropIdx: { type: Number, default: 0 },
    actors: [ActorSchema],
    globalSounds: { type: [ActionSchema], default: [] } 
}, { _id: false });

// --- FONCTION DE RÉCUPÉRATION SÉCURISÉE ---
const getModel = (name, schema) => {
    if (mongoose.models[name]) return mongoose.models[name];
    return mongoose.model(name, new mongoose.Schema(schema, { timestamps: true }));
};

// --- DÉFINITION DES MODÈLES ---
const Models = {
    Chapter: getModel('Chapter', {
        title: { type: String, default: "NOUVEAU" },
        section: { type: String, default: "GÉNÉRAL" },
        classroom: { type: String, default: "" },
        sharedLevel: { type: String, default: "" },
        teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
        isArchived: { type: Boolean, default: false },
        hiddenIn: { type: [String], default: [] }
    }),

    Classroom: getModel('Classroom', {
        name: String,
        level: String,
        type: { type: String, default: 'CLASS' },
        layout: { 
            separators: { type: [Number], default: [] },
            cols: { type: Number, default: 6 },
            rows: { type: Number, default: 5 }
        }
    }),

    Student: getModel('Student', {
        firstName: String, lastName: String, currentClass: String,
        email: { type: String, lowercase: true, trim: true },
        parentEmail: { type: String, lowercase: true, trim: true },
        classId: mongoose.Schema.Types.ObjectId,
        assignedGroups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }],
        behaviorRecords: [{
            teacherId: mongoose.Schema.Types.ObjectId,
            crosses: { type: Number, default: 0 },
            bonuses: { type: Number, default: 0 },
            weeksToRedemption: { type: Number, default: 3 },
            nextCrossRemovalAt: { type: Date, default: null }
        }],
        teacherNotes: [{ teacherId: mongoose.Schema.Types.ObjectId, text: String }],
        punishmentStatus: { type: String, default: 'NONE' },
        punishmentDueDate: Date, seatX: Number, seatY: Number, gender: String,
        punishmentLateMailSentAt: { type: Date, default: null },
        punishmentLateMailTo: { type: String, default: "" },
        punishmentLateMailError: { type: String, default: "" },
        indicators: Array,
        spellingMistakes: [{ wrong: String, correct: String, date: { type: Date, default: Date.now } }]
    }),

    Homework: getModel('Homework', {
        title: String, subject: String, isPunishment: { type: Boolean, default: false },
        targetClassrooms: [String], chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
        teacherId: mongoose.Schema.Types.ObjectId, levels: Array,
        assignedStudents: [mongoose.Schema.Types.ObjectId], isAllClass: { type: Boolean, default: true },
        isEnabled: { type: Boolean, default: true },
        date: { type: Date, default: Date.now }
    }),

    GameLevel: getModel('GameLevel', {
        title: String, 
        subject: { type: String, default: "GÉNÉRAL" }, 
        type: { type: String, default: 'zombie' }, // zombie, starship, etc.
        isTestGame: { type: Boolean, default: false }, 
        chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
        teacherId: mongoose.Schema.Types.ObjectId, targetClassrooms: [String],
        questions: Array, levels: Array, assignedStudents: [mongoose.Schema.Types.ObjectId],
        isAllClass: { type: Boolean, default: true },
        isEnabled: { type: Boolean, default: true },
        // MIROIR
        scenes: { type: Array, default: [] }, 
        generatedCode: { type: String, default: "" },
        globalIntro: { type: Object, default: {} }
    }),

    ScanSession: getModel('ScanSession', {
        title: String, teacherId: String, chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
        subjectUrls: [String], copyUrls: [String], corrections: Array,
        aiInstructions: { type: String, default: "Corrige sévèrement la syntaxe." },
        date: { type: Date, default: Date.now }
    }),

    Teacher: getModel('Teacher', {
        firstName: String, lastName: String, password: { type: String, required: true },
        mail: { type: String, default: '', trim: true, lowercase: true },
        subjectSections: [SectionSchema], taughtSubjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
        assignedClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }]
    }),

    Admin: getModel('Admin', {
        firstName: String, lastName: String, password: { type: String, required: true },
        role: { type: String, default: 'admin' }, isDeveloper: { type: Boolean, default: false }
    }),

    Subject: getModel('Subject', { name: String, color: String }),
    
    Submission: getModel('Submission', {
        studentId: mongoose.Schema.Types.ObjectId, homeworkId: mongoose.Schema.Types.ObjectId,
        levelIndex: Number, content: String, feedback: String, grade: String,
        antiCheat: { type: Object, default: {} }
    }),

    GameProgress: getModel('GameProgress', {
        studentId: mongoose.Schema.Types.ObjectId, gameId: mongoose.Schema.Types.ObjectId,
        levelReached: { type: Number, default: 0 }, lastScore: { type: Number, default: 0 }
    }),

    StudioProject: getModel('StudioProject', {
        title: { type: String, required: true },
        teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
        scenes: [SceneSchema],
        generatedCode: String,
        isProduction: { type: Boolean, default: false },
        isTrashed: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now }
    })
};

module.exports = Models;
