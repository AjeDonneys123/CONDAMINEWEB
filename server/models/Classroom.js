const mongoose = require('mongoose');

const ClassroomSchema = new mongoose.Schema({
    name: { type: String, required: true, uppercase: true },
    
    // NOUVEAU V142 : Niveau explicite (ex: "6", "1", "TERM")
    level: { type: String }, 
    
    type: { type: String, enum: ['CLASS', 'GROUP'], default: 'CLASS' },
    associatedClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }],
    yearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear' }
}, { collection: 'classrooms' });

module.exports = mongoose.models.Classroom || mongoose.model('Classroom', ClassroomSchema);