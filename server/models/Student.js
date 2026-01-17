

const mongoose = require('mongoose');

/**
 * SECTION 3 : LES ÉLÈVES (v.30 Multi-Groups)
 * Ajout du champ 'groups' pour gérer l'appartenance multiple (ex: 1D + 1CD + SPE_MATHS)
 */
const StudentSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true },
    gender: String,
    
    // INFOS PÉDAGOGIQUES
    currentClass: String, // La classe administrative "Home" (ex: 1D)
    groups: [String],     // Les autres groupes (ex: ["1CD", "Groupe Soutien"])
    options: [String],    // Les spécialités (ex: ["SPE: MATHS"])
    
    healthInfo: String,
    birthDate: String,
    
    driveFolderId: String, 
    drivePortfolioUrl: String,
    lastLogin: { type: Date, default: Date.now }
}, { collection: 'students' });

module.exports = mongoose.models.Student || mongoose.model('Student', StudentSchema);

