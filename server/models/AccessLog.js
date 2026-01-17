const mongoose = require('mongoose');
/**
 * SECTION 15 : LOGS D'ACCÈS
 * Sécurité et traçabilité des actions sur le système.
 */
const AccessLogSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    userName: String,
    userRole: String,
    action: String, // LOGIN, CREATE_HW, DELETE_CHAPTER
    timestamp: { type: Date, default: Date.now },
    ip: String
}, { collection: 'accesslogs' });
module.exports = mongoose.models.AccessLog || mongoose.model('AccessLog', AccessLogSchema);