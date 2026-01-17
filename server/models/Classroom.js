const mongoose = require('mongoose');
const ClassroomSchema = new mongoose.Schema({
    name: { type: String, required: true, uppercase: true },
    type: { type: String, enum: ['CLASS', 'GROUP'], default: 'CLASS' },
    yearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear' }
}, { collection: 'classrooms' });
module.exports = mongoose.models.Classroom || mongoose.model('Classroom', ClassroomSchema);