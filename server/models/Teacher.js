const mongoose = require('mongoose');

const TeacherSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    password: { type: String, required: true },
    // Chaque section a un nom (Histoire) et une couleur (#ef4444)
    subjectSections: { 
        type: [{ name: String, color: String }], 
        default: [
            { name: 'Histoire', color: '#ef4444' },
            { name: 'Géographie', color: '#3b82f6' },
            { name: 'EMC', color: '#22c55e' }
        ] 
    },
    driveFolderId: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Teacher', TeacherSchema);