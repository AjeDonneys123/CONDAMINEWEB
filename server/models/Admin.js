const mongoose = require('mongoose');
const AdminSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'developer'], default: 'admin' },
    subjectSections: { type: Array, default: [] },
    
    // Remplacement de isAdmin par isDeveloper
    isDeveloper: { type: Boolean, default: false }
}, { collection: 'admins' });
module.exports = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);