const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    fullName: { type: String }, 
    email: { type: String, lowercase: true, trim: true },
    
    // Classe Administrative (Maison mère) - Choix Unique
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' },
    currentClass: { type: String }, 

    // Groupes Pédagogiques (Options) - Choix Multiple
    assignedGroups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }],

    isTestAccount: { type: Boolean, default: false },

    birthDate: { type: Date },
    gender: { type: String, enum: ['M', 'F', ''] },
    lastLogin: { type: Date, default: Date.now }
}, { collection: 'students' });

module.exports = mongoose.models.Student || mongoose.model('Student', StudentSchema);