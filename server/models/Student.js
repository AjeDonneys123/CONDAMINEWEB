const mongoose = require('mongoose');

// Schéma pour les croix/bonus
const BehaviorRecordSchema = new mongoose.Schema({
    teacherId: { type: String, required: true },
    crosses: { type: Number, default: 0 },
    bonuses: { type: Number, default: 0 },
    lastCrossDate: { type: Date, default: null },
    weeksToRedemption: { type: Number, default: 3 }
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
    isTestAccount: { type: Boolean, default: false },
    lastLogin: { type: Date, default: Date.now }
}, { collection: 'students' });

module.exports = mongoose.models.Student || mongoose.model('Student', StudentSchema);