const mongoose = require('mongoose');

const TrainingImageSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, default: '' },
    contentType: { type: String, default: 'image/png' },
    data: { type: Buffer, required: true }
}, { _id: false });

const TrainingConfigSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, index: true },
    model: { type: mongoose.Schema.Types.Mixed, default: {} },
    images: { type: [TrainingImageSchema], default: [] }
}, { timestamps: true, collection: 'trainingconfigs' });

module.exports = mongoose.models.TrainingConfig || mongoose.model('TrainingConfig', TrainingConfigSchema);
