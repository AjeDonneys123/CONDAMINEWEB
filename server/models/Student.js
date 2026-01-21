const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
    // Identité
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    fullName: { type: String }, 
    
    // Contacts
    email: { type: String, lowercase: true, trim: true },
    parentEmail: { type: String, lowercase: true, trim: true }, // NOUVEAU

    // Scolarité
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' },
    currentClass: { type: String }, // Ex: "1D"
    currentLevel: { type: String }, // NOUVEAU (Ex: "1")

    // Groupes / Options
    assignedGroups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }],

    // Infos diverses
    gender: { type: String, enum: ['M', 'F', ''] },
    lastLogin: { type: Date, default: Date.now }
    
    // SUPPRIMÉS : birthDate, isTestAccount
}, { collection: 'students' });

module.exports = mongoose.models.Student || mongoose.model('Student', StudentSchema);