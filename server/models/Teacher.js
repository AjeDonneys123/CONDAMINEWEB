const mongoose = require('mongoose');

const SectionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    color: { type: String, default: '#6366f1' },
    
    // NOUVEAU V140 : Portée de la section
    scope: { type: String, enum: ['GLOBAL', 'LEVEL', 'CLASS'], default: 'GLOBAL' },
    target: { type: String, default: null } // ex: "6" ou "6A"
}, { _id: false });

const TeacherSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    password: { type: String, required: true },
    subjectSections: { type: [SectionSchema], default: [] },
    taughtSubjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
    assignedClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }],
    isDeveloper: { type: Boolean, default: false },
    driveFolderId: { type: String },
    isTestAccount: { type: Boolean, default: false }
}, { collection: 'teachers' });

module.exports = mongoose.models.Teacher || mongoose.model('Teacher', TeacherSchema);