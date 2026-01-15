const mongoose = require('mongoose');
const TeacherSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    password: { type: String, required: true },
    subjectSections: { 
        type: Array, 
        default: [
            { name: 'HISTOIRE', color: '#ef4444' },
            { name: 'GEOGRAPHIE', color: '#3b82f6' },
            { name: 'EMC', color: '#22c55e' }
        ] 
    }
});
module.exports = mongoose.models.Teacher || mongoose.model('Teacher', TeacherSchema);