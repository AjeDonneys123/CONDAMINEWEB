// @signatures: ProfModels, UnifiedSingleton, getModel
const mongoose = require('mongoose');

const SectionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    color: { type: String, default: '#6366f1' },
    scope: { type: String, enum: ['GLOBAL', 'LEVEL', 'CLASS'], default: 'GLOBAL' },
    target: { type: String, default: null },
    hiddenIn: { type: [String], default: [] } 
}, { _id: false });

const Schemas = {
    Chapter: new mongoose.Schema({ 
        title: { type: String, default: "NOUVEAU" }, 
        section: { type: String, default: "GÉNÉRAL" }, 
        classroom: { type: String, default: "" }, 
        sharedLevel: { type: String, default: "" }, 
        teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }, 
        isArchived: { type: Boolean, default: false },
        hiddenIn: { type: [String], default: [] } // NOUVEAU
    }, { timestamps: true }),

    Classroom: new mongoose.Schema({ 
        name: String, 
        level: String, 
        type: { type: String, default: 'CLASS' }, 
        layout: { separators: { type: [Number], default: [] } } 
    }),

    Student: new mongoose.Schema({ 
        firstName: String, 
        lastName: String, 
        currentClass: String, 
        classId: mongoose.Schema.Types.ObjectId, 
        assignedGroups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }],
        behaviorRecords: [{
            teacherId: mongoose.Schema.Types.ObjectId,
            crosses: { type: Number, default: 0 },
            bonuses: { type: Number, default: 0 },
            weeksToRedemption: { type: Number, default: 3 }
        }],
        teacherNotes: [{
            teacherId: mongoose.Schema.Types.ObjectId,
            text: String
        }],
        punishmentStatus: { type: String, default: 'NONE' }, 
        punishmentDueDate: Date,
        seatX: { type: Number, default: 0 }, 
        seatY: { type: Number, default: 0 },
        gender: { type: String, default: 'M' },
        indicators: { type: Array, default: [] },
        spellingMistakes: [{ wrong: String, correct: String, date: { type: Date, default: Date.now } }]
    }),

    Homework: new mongoose.Schema({ 
        title: String, 
        subject: String, 
        isPunishment: { type: Boolean, default: false }, 
        targetClassrooms: { type: [String], default: [] }, 
        chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' }, 
        teacherId: mongoose.Schema.Types.ObjectId, 
        levels: { type: Array, default: [] }, 
        assignedStudents: [mongoose.Schema.Types.ObjectId], 
        isAllClass: { type: Boolean, default: true }, 
        date: { type: Date, default: Date.now },
        hiddenIn: { type: [String], default: [] } // NOUVEAU
    }),

    GameLevel: new mongoose.Schema({ 
        title: String, 
        chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' }, 
        teacherId: mongoose.Schema.Types.ObjectId, 
        targetClassrooms: { type: [String], default: [] }, 
        questions: { type: Array, default: [] }, 
        assignedStudents: [mongoose.Schema.Types.ObjectId],
        isAllClass: { type: Boolean, default: true },
        hiddenIn: { type: [String], default: [] } // NOUVEAU
    }),

    ScanSession: new mongoose.Schema({ 
        title: String, 
        teacherId: String, 
        chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' }, 
        subjectUrls: { type: [String], default: [] }, 
        copyUrls: { type: [String], default: [] }, 
        corrections: { type: Array, default: [] },
        date: { type: Date, default: Date.now }
    }),

    Teacher: new mongoose.Schema({ 
        firstName: String, 
        lastName: String, 
        password: { type: String, required: true }, 
        subjectSections: [SectionSchema], 
        taughtSubjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
        assignedClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }] 
    }),

    Admin: new mongoose.Schema({ 
        firstName: String, 
        lastName: String, 
        password: { type: String, required: true }, 
        role: { type: String, default: 'admin' }, 
        isDeveloper: { type: Boolean, default: false } 
    }),

    Subject: new mongoose.Schema({ name: String, color: String }),

    Submission: new mongoose.Schema({ 
        studentId: mongoose.Schema.Types.ObjectId, 
        homeworkId: mongoose.Schema.Types.ObjectId, 
        levelIndex: Number,
        content: String, 
        feedback: String, 
        grade: String,
        date: { type: Date, default: Date.now }
    }),

    GameProgress: new mongoose.Schema({ 
        studentId: mongoose.Schema.Types.ObjectId, 
        gameId: mongoose.Schema.Types.ObjectId, 
        levelReached: { type: Number, default: 0 }, 
        lastScore: { type: Number, default: 0 } 
    }),

    StudioProject: new mongoose.Schema({ 
        title: String, 
        teacherId: mongoose.Schema.Types.ObjectId, 
        scenes: { type: Array, default: [] }, 
        generatedCode: String 
    }, { timestamps: true })
};

const getModel = (name) => mongoose.models[name] || mongoose.model(name, Schemas[name]);

module.exports = {
    Chapter: getModel('Chapter'),
    Classroom: getModel('Classroom'),
    Student: getModel('Student'),
    Homework: getModel('Homework'),
    GameLevel: getModel('GameLevel'),
    ScanSession: getModel('ScanSession'),
    Teacher: getModel('Teacher'),
    Admin: getModel('Admin'),
    Subject: getModel('Subject'),
    Submission: getModel('Submission'),
    GameProgress: getModel('GameProgress'),
    StudioProject: getModel('StudioProject')
};
