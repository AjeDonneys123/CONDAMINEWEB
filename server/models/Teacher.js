const mongoose = require('mongoose');

const TeacherSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    password: { type: String, required: true },
    subjectSections: { type: Array, default: [] },
    // Matières enseignées
    taughtSubjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
    // NOUVEAU : Classes assignées
    assignedClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }]
}, { collection: 'teachers' });

module.exports = mongoose.models.Teacher || mongoose.model('Teacher', TeacherSchema);