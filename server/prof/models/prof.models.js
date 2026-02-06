// @signatures: ProfModels, getModel
const mongoose = require('mongoose');

const SectionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    color: { type: String, default: '#6366f1' },
    scope: { type: String, enum: ['GLOBAL', 'LEVEL', 'CLASS'], default: 'GLOBAL' },
    target: { type: String, default: null },
    hiddenIn: { type: [String], default: [] } 
}, { _id: false });

const getModel = (name, schema) => {
    return mongoose.models[name] || mongoose.model(name, new mongoose.Schema(schema, { timestamps: true }));
};

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
        layout: { separators: { type: [Number], default: [] } }
    }),

    Student: getModel('Student', {
        firstName: String, lastName: String, currentClass: String,
        classId: mongoose.Schema.Types.ObjectId,
        assignedGroups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }],
        behaviorRecords: [{
            teacherId: mongoose.Schema.Types.ObjectId,
            crosses: { type: Number, default: 0 }, bonuses: { type: Number, default: 0 }, weeksToRedemption: { type: Number, default: 3 }
        }],
        teacherNotes: [{ teacherId: mongoose.Schema.Types.ObjectId, text: String }],
        punishmentStatus: { type: String, default: 'NONE' },
        punishmentDueDate: Date, seatX: Number, seatY: Number, gender: String,
        indicators: Array,
        spellingMistakes: [{ wrong: String, correct: String, date: { type: Date, default: Date.now } }]
    }),

    Homework: getModel('Homework', {
        title: String, subject: String, isPunishment: { type: Boolean, default: false },
        targetClassrooms: [String], chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
        teacherId: mongoose.Schema.Types.ObjectId, levels: Array,
        assignedStudents: [mongoose.Schema.Types.ObjectId], isAllClass: { type: Boolean, default: true },
        date: { type: Date, default: Date.now }
    }),

    GameLevel: getModel('GameLevel', {
        title: String, 
        // AJOUT OFFICIEL DU CHAMP SUBJECT
        subject: { type: String, default: "GÉNÉRAL" }, 
        chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
        teacherId: mongoose.Schema.Types.ObjectId, targetClassrooms: [String],
        questions: Array, levels: Array, assignedStudents: [mongoose.Schema.Types.ObjectId],
        isAllClass: { type: Boolean, default: true }
    }),

    ScanSession: getModel('ScanSession', {
        title: String, teacherId: String, chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
        subjectUrls: [String], copyUrls: [String], corrections: Array, date: { type: Date, default: Date.now }
    }),

    Teacher: getModel('Teacher', {
        firstName: String, lastName: String, password: { type: String, required: true },
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
        levelIndex: Number, content: String, feedback: String, grade: String
    }),

    GameProgress: getModel('GameProgress', {
        studentId: mongoose.Schema.Types.ObjectId, gameId: mongoose.Schema.Types.ObjectId,
        levelReached: { type: Number, default: 0 }, lastScore: { type: Number, default: 0 }
    }),

    StudioProject: getModel('StudioProject', {
        title: String, teacherId: mongoose.Schema.Types.ObjectId, scenes: Array, generatedCode: String
    })
};

module.exports = Models;
