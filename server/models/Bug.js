const mongoose = require('mongoose');
const BugSchema = new mongoose.Schema({
    reporter: String,
    description: String,
    createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.models.Bug || mongoose.model('Bug', BugSchema);