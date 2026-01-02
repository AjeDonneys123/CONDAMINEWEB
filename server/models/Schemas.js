const mongoose = require('mongoose');

// On force les noms de collections 'players' et 'homeworks' pour la compatibilité BDD
const playerSchema = new mongoose.Schema({ 
    firstName: String, lastName: String, classroom: String, 
    spellingMistakes: { type: [{ wrong: String, correct: String, rule: String, date: { type: Date, default: Date.now } }], default: [] } 
});
mongoose.model('Player', playerSchema, 'players');

const homeworkSchema = new mongoose.Schema({ 
    title: String, classroom: String, 
    levels: [{ instruction: String, aiPrompt: String, attachmentUrls: [String], questionImage: String }], 
    date: { type: Date, default: Date.now } 
});
mongoose.model('Homework', homeworkSchema, 'homeworks');

const gameLevelSchema = new mongoose.Schema({ 
    chapterId: String, title: String, questions: Array, createdAt: { type: Date, default: Date.now } 
});
mongoose.model('GameLevel', gameLevelSchema, 'game_levels');