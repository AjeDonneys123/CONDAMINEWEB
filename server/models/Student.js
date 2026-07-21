const mongoose = require('mongoose');
const TEST_ACCOUNT_EMAIL = 'vuillet433@gmail.com';

// Schéma pour les croix/bonus
const BehaviorRecordSchema = new mongoose.Schema({
    teacherId: { type: String, required: true },
    crosses: { type: Number, default: 0 },
    bonuses: { type: Number, default: 0 },
    lastCrossDate: { type: Date, default: null },
    weeksToRedemption: { type: Number, default: 3 },
    nextCrossRemovalAt: { type: Date, default: null }
}, { _id: false });

// Schéma pour les notes prof
const NoteSchema = new mongoose.Schema({
    teacherId: { type: String, required: true },
    text: { type: String, default: "" }
}, { _id: false });

const StudentSchema = new mongoose.Schema({
    // Identité
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    fullName: { type: String }, 
    
    // Contacts
    email: { type: String, lowercase: true, trim: true },
    parentEmail: { type: String, lowercase: true, trim: true },
    birthDate: { type: String, default: '' },
    dateOfBirth: { type: String, default: '' },
    dob: { type: String, default: '' },
    studentPassword: { type: String, default: '' },
    hasStudentPassword: { type: Boolean, default: false },

    // Scolarité
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' },
    currentClass: { type: String }, 
    currentLevel: { type: String }, 
    assignedGroups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }],

    // Plan de classe (Coordonnées)
    seatX: { type: Number, default: 0 }, 
    seatY: { type: Number, default: 0 }, 
    
    // Vie scolaire
    behaviorRecords: { type: [BehaviorRecordSchema], default: [] },
    teacherNotes: { type: [NoteSchema], default: [] },

    // --- SYSTÈME PUNITIONS V3 ---
    punishmentStatus: { type: String, enum: ['NONE', 'PENDING', 'LATE'], default: 'NONE' },
    punishmentDueDate: { type: Date }, // Date limite pour rendre la punition
    totalPunishments: { type: Number, default: 0 }, // Historique compteur

    // Système
    activeTutorSession: {
        moduleId: { type: String, default: '' },
        stepId: { type: String, default: '' },
        stepIndex: { type: Number, default: 0 },
        token: { type: String, default: '' },
        sourceUrl: { type: String, default: '' },
        validationUrl: { type: String, default: '' },
        instructionDocId: { type: String, default: '' },
        instructionDocUrl: { type: String, default: '' },
        expiresAt: { type: Date, default: null },
        updatedAt: { type: Date, default: null }
    },
    isTestAccount: { type: Boolean, default: false },
    lastLogin: { type: Date, default: Date.now }
}, { collection: 'students' });

function normalizeStudentUpdate(update) {
    if (!update || typeof update !== 'object') return update;
    const directFlag = update.isTestAccount;
    const setFlag = update.$set?.isTestAccount;
    const isTestAccount = setFlag !== undefined ? setFlag : directFlag;
    if (isTestAccount !== true) return update;
    if (update.$set && typeof update.$set === 'object') {
        update.$set.email = TEST_ACCOUNT_EMAIL;
    } else {
        update.email = TEST_ACCOUNT_EMAIL;
    }
    return update;
}

StudentSchema.pre('save', function forceSharedEmailForTestAccount(next) {
    if (this.isTestAccount === true) {
        this.email = TEST_ACCOUNT_EMAIL;
    }
    next();
});

StudentSchema.pre('findOneAndUpdate', function forceSharedEmailBeforeFindOneAndUpdate(next) {
    normalizeStudentUpdate(this.getUpdate());
    next();
});

StudentSchema.pre('updateOne', function forceSharedEmailBeforeUpdateOne(next) {
    normalizeStudentUpdate(this.getUpdate());
    next();
});

StudentSchema.pre('updateMany', function forceSharedEmailBeforeUpdateMany(next) {
    normalizeStudentUpdate(this.getUpdate());
    next();
});

module.exports = mongoose.models.Student || mongoose.model('Student', StudentSchema);
