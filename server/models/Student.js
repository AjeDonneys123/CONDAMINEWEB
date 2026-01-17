const mongoose = require('mongoose');
const StudentSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true },
    gender: String,
    healthInfo: String,
    driveFolderId: String,
    lastLogin: { type: Date, default: Date.now }
}, { collection: 'students' });
module.exports = mongoose.models.Student || mongoose.model('Student', StudentSchema);