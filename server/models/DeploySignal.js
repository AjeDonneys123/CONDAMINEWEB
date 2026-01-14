const mongoose = require('mongoose');

const DeploySignalSchema = new mongoose.Schema({
    status: { type: String, default: 'live' },
    updatedAt: { type: Date, default: Date.now }
});

// Protection contre la redéclaration
module.exports = mongoose.models.DeploySignal || mongoose.model('DeploySignal', DeploySignalSchema);