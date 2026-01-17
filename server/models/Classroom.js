

const mongoose = require('mongoose');

/**
 * SECTION 5 : LES CLASSES & GROUPES
 * v.31 : Distinction entre "Classe Administrative" et "Groupe Pédagogique"
 */
const ClassroomSchema = new mongoose.Schema({
    name: { type: String, required: true, uppercase: true },
    type: { type: String, enum: ['CLASS', 'GROUP'], default: 'CLASS' }, // NOUVEAU
    level: String,
    yearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear' }
}, { collection: 'classrooms' });

module.exports = mongoose.models.Classroom || mongoose.model('Classroom', ClassroomSchema);

