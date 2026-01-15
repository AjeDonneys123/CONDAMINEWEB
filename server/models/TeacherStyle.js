const mongoose = require('mongoose');
const TeacherStyleSchema = new mongoose.Schema({ teacherId: String, pedagogicalMemory: String });
module.exports = mongoose.models.TeacherStyle || mongoose.model('TeacherStyle', TeacherStyleSchema);