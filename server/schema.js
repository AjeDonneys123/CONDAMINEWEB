const mongoose = require('mongoose');

// 1. JOUEURS
const playerSchema = new mongoose.Schema({ 
    firstName: String, lastName: String, classroom: String, 
    validatedQuestions: [String],
    validatedLevels: { type: [mongoose.Schema.Types.Mixed], default: [] },
    spellingMistakes: { type: [{ wrong: String, correct: String, rule: String, date: { type: Date, default: Date.now } }], default: [] },
    created_at: { type: Date, default: Date.now }
}, { minimize: false });
mongoose.model('Player', playerSchema, 'players');

// 2. DEVOIRS
const homeworkSchema = new mongoose.Schema({ 
    title: String, classroom: String, 
    levels: [{ instruction: String, attachmentUrls: [String], questionImage: String }], 
    date: { type: Date, default: Date.now } 
});
mongoose.model('Homework', homeworkSchema, 'homeworks');

// 3. COPIES (SUBMISSIONS)
const submissionSchema = new mongoose.Schema({
    homeworkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Homework' },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    classroom: String,
    levelsResults: [{ levelIndex: Number, userText: String, aiFeedback: String, grade: String }],
    submittedAt: { type: Date, default: Date.now }
});
mongoose.model('Submission', submissionSchema, 'submissions');

// 4. BUGS
mongoose.model('Bug', new mongoose.Schema({
    reporter: String, classroom: String, description: String, date: { type: Date, default: Date.now }
}), 'bugs');

// 5. JEUX
mongoose.model('GameLevel', new mongoose.Schema({ 
    chapterId: String, title: String, questions: Array, createdAt: { type: Date, default: Date.now } 
}), 'game_levels');