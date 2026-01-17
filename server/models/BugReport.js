const mongoose = require('mongoose');
const BugReportSchema = new mongoose.Schema({
    description: String,
    stack: String,
    status: { type: String, default: 'open' },
    createdAt: { type: Date, default: Date.now }
}, { collection: 'bugreports' });
module.exports = mongoose.models.BugReport || mongoose.model('BugReport', BugReportSchema);