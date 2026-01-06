const mongoose = require('mongoose');

// 1. JOUEURS
mongoose.model('Player', new mongoose.Schema({ 
    firstName: String, lastName: String, classroom: String, 
    spellingMistakes: { type: Array, default: [] } 
}), 'players');

// 2. CHAPITRES (STRICT)
const ChapterSchema = new mongoose.Schema({
    title: { type: String, default: '' },
    subject: { type: String, required: true }, // H, G ou E
    isArchived: { type: Boolean, default: false },
    classroom: { type: String, required: true }
});
mongoose.model('Chapter', ChapterSchema, 'chapters');

// 3. DEVOIRS
mongoose.model('Homework', new mongoose.Schema({ 
    title: String, classroom: String, targetGrade: String, targetPlayerIds: [String],
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
    levels: Array, date: { type: Date, default: Date.now } 
}), 'homeworks');

// 4. JEUX
mongoose.model('GameLevel', new mongoose.Schema({ 
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
    title: String, targetGrade: String, classroom: String, questions: Array
}), 'game_levels');