const mongoose = require('mongoose');
const AdminSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'developer'], default: 'admin' },
    subjectSections: { type: Array, default: [] },
    isDeveloper: { type: Boolean, default: false },
    
    // V71 : Flag de compte de test
    isTestAccount: { type: Boolean, default: false }
}, { collection: 'admins' });
module.exports = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);