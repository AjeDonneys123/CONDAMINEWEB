const mongoose = require('mongoose');

const TeacherSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    password: { type: String, required: true },
    // Valeurs par défaut avec couleurs distinctes
    subjectSections: { 
        type: [{ name: String, color: String }], 
        default: [
            { name: 'Histoire', color: '#ef4444' },   // Rouge
            { name: 'Géographie', color: '#3b82f6' }, // Bleu
            { name: 'EMC', color: '#22c55e' }         // Vert
        ] 
    },
    driveFolderId: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Teacher', TeacherSchema);