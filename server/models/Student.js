const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    fullName: { type: String }, 
    email: { type: String, lowercase: true, trim: true },
    
    // Classe Administrative (Maison)
    currentClass: { type: String }, 
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' },
    
    // Étiquette de demi-groupe interne
    subGroup: { type: String, enum: ['A', 'B', null], default: null },

    // V54 : Flag pour identifier les comptes techniques
    isTestAccount: { type: Boolean, default: false },

    birthDate: { type: Date },
    gender: { type: String, enum: ['M', 'F', ''] },
    healthInfo: String,
    driveFolderId: String,
    lastLogin: { type: Date, default: Date.now }
}, { collection: 'students' });

module.exports = mongoose.models.Student || mongoose.model('Student', StudentSchema);