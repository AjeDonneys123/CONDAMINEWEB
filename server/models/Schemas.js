const mongoose = require('mongoose');

// 1. JOUEURS (PLAYERS)
const playerSchema = new mongoose.Schema({ 
    firstName: String, 
    lastName: String, 
    classroom: String, 
    spellingMistakes: { 
        type: [{ 
            wrong: String, 
            correct: String, 
            rule: String, 
            date: { type: Date, default: Date.now } 
        }], 
        default: [] 
    } 
});
mongoose.model('Player', playerSchema, 'players');

// 2. DEVOIRS (HOMEWORKS - LA CONSIGNE)
const homeworkSchema = new mongoose.Schema({ 
    title: String, 
    classroom: String, 
    levels: [{ 
        instruction: String, 
        aiPrompt: String, 
        attachmentUrls: [String], 
        questionImage: String 
    }], 
    date: { type: Date, default: Date.now } 
});
mongoose.model('Homework', homeworkSchema, 'homeworks');

// 3. COPIES (SUBMISSIONS - LES RÉPONSES)
const submissionSchema = new mongoose.Schema({
    homeworkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Homework' },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    classroom: String,
    levelsResults: [{
        levelIndex: Number,
        userText: String,
        aiFeedback: String,
        grade: String
    }],
    submittedAt: { type: Date, default: Date.now }
});
mongoose.model('Submission', submissionSchema, 'submissions');

// 4. JEUX (GAME LEVELS)
const gameLevelSchema = new mongoose.Schema({ 
    chapterId: String, 
    title: String, 
    questions: Array, 
    createdAt: { type: Date, default: Date.now } 
});
mongoose.model('GameLevel', gameLevelSchema, 'game_levels');