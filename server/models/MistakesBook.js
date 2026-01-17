const mongoose = require('mongoose');
const MistakesBookSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    wrong: String,
    correct: String,
    context: String,
    date: { type: Date, default: Date.now }
}, { collection: 'mistakes' });
module.exports = mongoose.models.MistakesBook || mongoose.model('MistakesBook', MistakesBookSchema);