const mongoose = require('mongoose');
const HomeworkSchema = new mongoose.Schema({
    title: String, classroom: String, chapterId: mongoose.Schema.Types.ObjectId, levels: Array
}, { collection: 'homeworks' });
module.exports = mongoose.models.Homework || mongoose.model('Homework', HomeworkSchema);