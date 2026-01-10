const mongoose = require('mongoose');

const TeacherSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    password: { type: String, required: true },
    subject: { type: String, default: "" },
    driveFolderId: String, // Dossier personnel du prof dans CondaClasse
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Teacher', TeacherSchema);