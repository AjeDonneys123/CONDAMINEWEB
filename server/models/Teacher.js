const mongoose = require('mongoose');

const TeacherSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    password: { type: String, required: true },
    subjectSections: { type: Array, default: [] },
    taughtSubjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
    assignedClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }],
    isDeveloper: { type: Boolean, default: false },
    driveFolderId: { type: String },
    
    // V71 : Flag de compte de test pour le bouton retour dev
    isTestAccount: { type: Boolean, default: false }
}, { collection: 'teachers' });

module.exports = mongoose.models.Teacher || mongoose.model('Teacher', TeacherSchema);