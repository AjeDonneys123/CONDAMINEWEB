const mongoose = require('mongoose');
const AcademicYearSchema = new mongoose.Schema({
    label: { type: String, required: true }, // ex: "2024-2025"
    isCurrent: { type: Boolean, default: true }
}, { collection: 'academicyears' });
module.exports = mongoose.models.AcademicYear || mongoose.model('AcademicYear', AcademicYearSchema);