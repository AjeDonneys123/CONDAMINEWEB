const mongoose = require('mongoose');
const DeploySignalSchema = new mongoose.Schema({ status: String, updatedAt: Date });
module.exports = mongoose.models.DeploySignal || mongoose.model('DeploySignal', DeploySignalSchema);