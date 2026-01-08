const mongoose = require('mongoose');

const BugSchema = new mongoose.Schema({
    reporter: String,
    classroom: String,
    description: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Bug', BugSchema);