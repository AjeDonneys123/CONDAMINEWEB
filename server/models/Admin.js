const mongoose = require('mongoose');
const AdminSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    password: { type: String, required: true },
    // Rôle : 'admin' (classique) ou 'developer' (accès total)
    role: { type: String, enum: ['admin', 'developer'], default: 'admin' },
    // NOUVEAU : Permet aux admins/devs de gérer leurs propres sections comme les profs
    subjectSections: { type: Array, default: [] }
}, { collection: 'admins' });
module.exports = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);