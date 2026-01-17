const mongoose = require('mongoose');

const ProjectDocSchema = new mongoose.Schema({
    fileName: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    path: String,
    lastKnownSize: Number,
    lastKnownModified: Date,
    updatedAt: { type: Date, default: Date.now }
}, { collection: 'projectdocs' });

module.exports = mongoose.models.ProjectDoc || mongoose.model('ProjectDoc', ProjectDocSchema);