const mongoose = require('mongoose');
const BugReportSchema = new mongoose.Schema({
    reporterName: { type: String, default: 'Utilisateur' },
    reporterRole: { type: String, default: 'unknown' },
    reporterId: { type: String, default: '' },
    description: { type: String, required: true },
    page: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    stack: String,
    status: { type: String, default: 'open' },
    createdAt: { type: Date, default: Date.now }
}, { collection: 'bugreports' });
module.exports = mongoose.models.BugReport || mongoose.model('BugReport', BugReportSchema);
