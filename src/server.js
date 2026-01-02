const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const nodeFetch = require('node-fetch');
if (!global.fetch) { global.fetch = nodeFetch; }

const express = require('express');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI;

mongoose.connect(mongoUri).then(() => console.log('✅ MongoDB Connecté')).catch(err => console.error(err));

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// MODÈLES
const Player = mongoose.model('Player', new mongoose.Schema({ 
    firstName: String, lastName: String, classroom: String, 
    validatedQuestions: { type: [String], default: [] },
    spellingMistakes: { type: Array, default: [] }
}));

const Homework = mongoose.model('Homework', new mongoose.Schema({ 
    title: String, classroom: String, levels: Array, date: { type: Date, default: Date.now } 
}));

const GameLevel = mongoose.model('GameLevel', new mongoose.Schema({ 
    classroom: String, title: String, lesson: String, questions: Array, createdAt: { type: Date, default: Date.now } 
}));

// TOLÉRANCE NOM
function isFuzzyMatch(inputStr, storedStr) {
    if (!inputStr || !storedStr) return false;
    const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-]/g, " ").split(/\s+/).filter(w => w.length > 1);
    const iW = norm(inputStr); const sW = norm(storedStr);
    return iW.some(w => sW.includes(w)) || sW.some(w => iW.includes(w));
}

// --- ROUTES ---
app.post('/api/register', async (req, res) => { 
    const { firstName, lastName, classroom, password } = req.body; 
    if (firstName?.toLowerCase() === "jean" && lastName?.toLowerCase() === "vuillet") {
        if (password === "Clemenceau1919") return res.json({ ok: true, id: "prof", firstName: "Jean", lastName: "Vuillet", classroom: "Professeur" });
        else return res.status(401).json({ ok: false, message: "Mot de passe incorrect" });
    }
    try {
        const allPlayers = await Player.find({ classroom });
        const match = allPlayers.find(p => isFuzzyMatch(firstName, p.firstName) && isFuzzyMatch(lastName, p.lastName));
        if (match) res.json({ ok: true, id: match._id, firstName: match.firstName, lastName: match.lastName, classroom: match.classroom });
        else res.status(404).json({ ok: false, message: "Élève non trouvé." });
    } catch (e) { res.status(500).json({ ok: false }); }
});

app.get('/api/players', async (req, res) => {
    try { res.json(await Player.find().sort({ classroom: 1, lastName: 1 })); } catch (e) { res.json([]); }
});

app.post('/api/reset-player', async (req, res) => {
    try { await Player.findByIdAndUpdate(req.body.playerId, { validatedQuestions: [], spellingMistakes: [] }); res.json({ ok: true }); } 
    catch (e) { res.json({ ok: false }); }
});

app.post('/api/homework', async (req, res) => {
    try { const hw = new Homework(req.body); await hw.save(); res.json({ ok: true }); } 
    catch (e) { res.status(500).json({ ok: false }); }
});

app.post('/api/game-levels', async (req, res) => {
    try { const gl = new GameLevel(req.body); await gl.save(); res.json({ ok: true }); } 
    catch (e) { res.status(500).json({ ok: false }); }
});

app.listen(port, () => console.log(`🚀 Serveur prêt port ${port}`));