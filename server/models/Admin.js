const mongoose = require('mongoose');

const SectionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    color: { type: String, default: '#6366f1' },
    scope: { type: String, enum: ['GLOBAL', 'LEVEL', 'CLASS'], default: 'GLOBAL' },
    target: { type: String, default: null }
}, { _id: false });

const AdminSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'developer'], default: 'admin' },
    subjectSections: { type: [SectionSchema], default: [] },
    isDeveloper: { type: Boolean, default: false },
    isTestAccount: { type: Boolean, default: false }
}, { collection: 'admins' });

module.exports = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);