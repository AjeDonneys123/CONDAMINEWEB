const mongoose = require('mongoose');

// 1. JOUEURS
mongoose.model('Player', new mongoose.Schema({ 
    firstName: String, lastName: String, classroom: String, 
    spellingMistakes: { type: Array, default: [] } 
}), 'players');

// 2. DEVOIRS
mongoose.model('Homework', new mongoose.Schema({ 
    title: String, classroom: String, levels: Array, date: { type: Date, default: Date.now } 
}), 'homeworks');

// 3. COPIES
mongoose.model('Submission', new mongoose.Schema({
    homeworkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Homework' },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    classroom: String,
    levelsResults: Array,
    submittedAt: { type: Date, default: Date.now }
}), 'submissions');

// 4. BUGS
mongoose.model('Bug', new mongoose.Schema({
    reporter: String, classroom: String, description: String, status: { type: String, default: 'ouvert' }, date: { type: Date, default: Date.now }
}), 'bugs');

// 5. JEUX (AJOUT DU CHAMP CLASSROOM)
mongoose.model('GameLevel', new mongoose.Schema({ 
    chapterId: String, 
    title: String, 
    classroom: { type: String, default: 'Toutes' }, // <--- NOUVEAU CHAMP
    questions: Array, 
    createdAt: { type: Date, default: Date.now } 
}), 'game_levels');