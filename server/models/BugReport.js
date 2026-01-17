const mongoose = require('mongoose');
/**
 * SECTION 17 : RAPPORTS DE BUGS
 * Trace les erreurs manuelles (bouton 🪲) et les erreurs système (auto-capture).
 */
const BugReportSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    userName: String,
    userRole: String,
    description: String,
    url: String,
    userAgent: String,
    status: { type: String, enum: ['open', 'fixed'], default: 'open' },
    createdAt: { type: Date, default: Date.now }
}, { collection: 'bugreports' });

module.exports = mongoose.models.BugReport || mongoose.model('BugReport', BugReportSchema);