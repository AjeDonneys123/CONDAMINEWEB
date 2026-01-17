const mongoose = require('mongoose');
const AccessLogSchema = new mongoose.Schema({
    userId: String,
    action: String,
    timestamp: { type: Date, default: Date.now }
}, { collection: 'accesslogs' });
module.exports = mongoose.models.AccessLog || mongoose.model('AccessLog', AccessLogSchema);