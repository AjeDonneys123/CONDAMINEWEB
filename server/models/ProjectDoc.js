const mongoose = require('mongoose');
const ProjectDocSchema = new mongoose.Schema({
    fileName: { type: String, unique: true },
    description: String
}, { collection: 'projectdocs' });
module.exports = mongoose.models.ProjectDoc || mongoose.model('ProjectDoc', ProjectDocSchema);