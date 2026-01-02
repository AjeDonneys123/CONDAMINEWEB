const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const nodeFetch = require('node-fetch');
if (!global.fetch) { global.fetch = nodeFetch; }

const express = require('express');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI;
const geminiKey = process.env.GEMINI_API_KEY;

// SCHÉMAS
const playerSchema = new mongoose.Schema({ 
    firstName: String, lastName: String, classroom: String, 
    spellingMistakes: { type: [{ wrong: String, correct: String, rule: String, date: { type: Date, default: Date.now } }], default: [] } 
});
const Player = mongoose.model('Player', playerSchema);

const homeworkSchema = new mongoose.Schema({ 
    title: String, classroom: String, levels: Array, date: { type: Date, default: Date.now } 
});
const Homework = mongoose.model('Homework', homeworkSchema);

mongoose.connect(mongoUri).then(() => console.log('✅ MongoDB Connecté')).catch(err => console.error(err));

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- IA : ANALYSE DOUBLE CORRECTION ---
app.post('/api/analyze-homework', async (req, res) => {
    const { userText, homeworkInstruction, playerId } = req.body;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiKey}`;
    
    const prompt = `Tu es un professeur de français expert. 
    Sujet: ${homeworkInstruction}. 
    Réponse élève: ${userText}.
    
    TACHE:
    1. Analyse le FOND (pertinence des idées).
    2. Analyse la FORME (orthographe, grammaire).
    3. Produis un tableau de fautes si nécessaire.

    RÉPONDS UNIQUEMENT EN JSON STRICT :
    {
      "feedback_fond": "Texte HTML pédagogique sur le contenu",
      "grade": "xx/20",
      "corrections": [
        {"wrong": "mot faux", "correct": "mot juste", "rule": "règle de grammaire ou usage"}
      ]
    }`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: "application/json" } })
        });
        const result = await response.json();
        const json = JSON.parse(result.candidates[0].content.parts[0].text);

        // Sauvegarde automatique des fautes dans le profil de l'élève
        if (playerId && json.corrections && json.corrections.length > 0) {
            await Player.findByIdAndUpdate(playerId, { 
                $push: { spellingMistakes: { $each: json.corrections } } 
            });
        }

        res.json(json);
    } catch (e) {
        res.status(500).json({ error: "IA indisponible" });
    }
});

// --- ROUTES FAUTES ---
app.get('/api/player-mistakes/:id', async (req, res) => {
    const p = await Player.findById(req.params.id);
    res.json(p ? p.spellingMistakes : []);
});

app.post('/api/delete-mistake', async (req, res) => {
    const { playerId, mistakeId } = req.body;
    await Player.findByIdAndUpdate(playerId, { 
        $pull: { spellingMistakes: { _id: mistakeId } } 
    });
    res.json({ ok: true });
});

// ... Autres routes (Homework, Register) ...
app.get('/api/homework/:classroom', async (req, res) => {
    const list = await Homework.find({ $or: [{ classroom: req.params.classroom }, { classroom: "Toutes" }] }).sort({ date: -1 });
    res.json(list);
});
app.get('/api/homework-all', async (req, res) => { res.json(await Homework.find().sort({ date: -1 })); });
app.post('/api/register', async (req, res) => {
    const { firstName, lastName, classroom, password } = req.body;
    if (firstName?.toLowerCase() === "jean" && password === "Clemenceau1919") return res.json({ ok: true, id: "prof", firstName: "Jean", lastName: "Vuillet", classroom: "Professeur" });
    const match = await Player.findOne({ firstName, lastName, classroom });
    if (match) res.json({ ok: true, id: match._id, firstName, lastName, classroom });
    else res.status(404).json({ ok: false });
});

app.listen(port, () => console.log(`🚀 Serveur prêt port ${port}`));