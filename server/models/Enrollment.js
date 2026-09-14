const mongoose = require('mongoose');
const EnrollmentSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
    yearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true }
}, { collection: 'enrollments' });
EnrollmentSchema.index({ studentId: 1, classId: 1 });
EnrollmentSchema.index({ classId: 1 });
module.exports = mongoose.models.Enrollment || mongoose.model('Enrollment', EnrollmentSchema);
