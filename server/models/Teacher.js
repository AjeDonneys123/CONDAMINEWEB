const mongoose = require('mongoose');
const TeacherSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    password: { type: String, required: true },
    subjectSections: { type: Array, default: [] }
}, { collection: 'teachers' });
module.exports = mongoose.models.Teacher || mongoose.model('Teacher', TeacherSchema);