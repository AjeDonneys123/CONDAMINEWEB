


const mongoose = require('mongoose');
const AcademicYearSchema = new mongoose.Schema({
    label: { type: String, required: true }, 
    isCurrent: { type: Boolean, default: true }
}, { collection: 'academicyears' });
module.exports = mongoose.models.AcademicYear || mongoose.model('AcademicYear', AcademicYearSchema);


