const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    // NOUVEAU CHAMP DEMANDÉ
    fullName: { type: String }, 
    
    email: { type: String, lowercase: true, trim: true },
    
    currentClass: { type: String }, 
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' },
    
    birthDate: { type: Date },
    gender: { type: String, enum: ['M', 'F', ''] },
    
    healthInfo: String,
    driveFolderId: String,
    lastLogin: { type: Date, default: Date.now }
}, { collection: 'students' });

module.exports = mongoose.models.Student || mongoose.model('Student', StudentSchema);