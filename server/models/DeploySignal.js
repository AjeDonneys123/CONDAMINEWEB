const mongoose = require('mongoose');

const DeploySignalSchema = new mongoose.Schema({
    build: { type: Number, required: true },
    status: { type: String, default: 'deploying' },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DeploySignal', DeploySignalSchema);