const mongoose = require('mongoose');
const MistakesBookSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    wrong: String,
    correct: String,
    context: String,
    sourceType: { type: String, default: '' },
    sourceRef: { type: String, default: '' },
    fingerprint: { type: String, index: true },
    date: { type: Date, default: Date.now }
}, { collection: 'mistakes' });
module.exports = mongoose.models.MistakesBook || mongoose.model('MistakesBook', MistakesBookSchema);
