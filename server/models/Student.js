const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true },
    
    // AJOUT EXPLICITE DES CHAMPS CLASSE
    currentClass: { type: String }, // Ex: "6B" (Pour affichage rapide)
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }, // Lien technique
    
    gender: String,
    healthInfo: String,
    driveFolderId: String,
    lastLogin: { type: Date, default: Date.now }
}, { collection: 'students' });

module.exports = mongoose.models.Student || mongoose.model('Student', StudentSchema);