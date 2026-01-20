const mongoose = require('mongoose');

/**
 * 🏫 MODÈLE CLASSE/GROUPE V50
 * Une structure simple : soit une Division (Administrative), soit un Groupe (Pédagogique).
 */
const ClassroomSchema = new mongoose.Schema({
    name: { type: String, required: true, uppercase: true },
    type: { type: String, enum: ['CLASS', 'GROUP'], default: 'CLASS' },
    
    // Pour les GROUPES : liste des classes administratives d'origine
    associatedClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }],
    
    yearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear' }
}, { collection: 'classrooms' });

module.exports = mongoose.models.Classroom || mongoose.model('Classroom', ClassroomSchema);