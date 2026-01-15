const mongoose = require('mongoose');
const TeacherSchema = new mongoose.Schema({
    firstName: String, lastName: String, password: { type: String, default: "Clemenceau1919" }
});
module.exports = mongoose.models.Teacher || mongoose.model('Teacher', TeacherSchema);