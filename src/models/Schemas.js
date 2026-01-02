const mongoose = require('mongoose');

// On définit tous les schémas ici pour qu'ils soient accessibles partout
mongoose.model('Player', new mongoose.Schema({ 
    firstName: String, lastName: String, classroom: String, spellingMistakes: Array 
}), 'players');

mongoose.model('Homework', new mongoose.Schema({ 
    title: String, classroom: String, levels: Array, date: { type: Date, default: Date.now } 
}), 'homeworks');

mongoose.model('GameLevel', new mongoose.Schema({ 
    chapterId: String, title: String, questions: Array, createdAt: { type: Date, default: Date.now } 
}), 'game_levels');