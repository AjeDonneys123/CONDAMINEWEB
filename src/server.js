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

// --- 1. ENREGISTREMENT DES SCHÉMAS (OBLIGATOIRE AU DÉBUT) ---
const playerSchema = new mongoose.Schema({ 
    firstName: String, lastName: String, classroom: String, spellingMistakes: { type: Array, default: [] } 
});
const Player = mongoose.model('Player', playerSchema);

const gameLevelSchema = new mongoose.Schema({ 
    chapterId: String, title: String, questions: Array, createdAt: { type: Date, default: Date.now } 
});
const GameLevel = mongoose.model('GameLevel', gameLevelSchema);

mongoose.connect(mongoUri)
    .then(() => console.log('✅ MongoDB Connecté'))
    .catch(err => console.error('❌ Erreur Mongo:', err));

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- 2. IA : APPEL DIRECT GEMINI 2.0 AVEC DEBUGGING TOTAL ---
app.post('/api/generate-game-content', async (req, res) => {
    const { topic } = req.body;
    console.log("\n------------------------------------------------");
    console.log("🤖 [IA DEBUG] Démarrage génération pour:", topic);
    
    // Tentative avec le modèle 2.0 Flash (version expérimentale actuelle)
    const model = "gemini-2.0-flash-exp";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
    
    const prompt = `Génère un quiz de 5 questions QCM sur : ${topic}.
    Réponds UNIQUEMENT un tableau JSON : [{"q":"Question","options":["A","B","C","D"],"a":0}]`;

    try {
        console.log(`📡 [IA DEBUG] Envoi vers: ${url}`);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { response_mime_type: "application/json" }
            })
        });
        
        const rawResponse = await response.text(); // On récupère le texte brut d'abord
        console.log("📥 [IA DEBUG] RÉPONSE BRUTE DU SERVEUR GOOGLE :");
        console.log(rawResponse);
        console.log("------------------------------------------------\n");

        const result = JSON.parse(rawResponse);
        
        if (result.error) {
            console.error("❌ [IA DEBUG] Erreur détectée dans le JSON:", result.error.message);
            return res.status(500).json({ error: result.error.message });
        }

        if (result.candidates && result.candidates[0].content) {
            const text = result.candidates[0].content.parts[0].text;
            res.json(JSON.parse(text));
        } else {
            throw new Error("Structure de réponse inattendue (voir log brut)");
        }

    } catch (e) {
        console.error("💥 [IA DEBUG] CRASH FATAL:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// --- 3. AUTRES ROUTES ---
app.get('/api/players', async (req, res) => {
    try { res.json(await Player.find().sort({ lastName: 1 })); } catch(e) { res.status(500).json([]); }
});

app.get('/api/game-levels/:classroom', async (req, res) => {
    try { res.json(await GameLevel.find({}).sort({ createdAt: -1 })); } catch(e) { res.status(500).json([]); }
});

app.post('/api/game-levels', async (req, res) => {
    const { _id, ...data } = req.body;
    try {
        if (_id) await GameLevel.findByIdAndUpdate(_id, data);
        else await new GameLevel(data).save();
        res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false }); }
});

app.delete('/api/game-levels/:id', async (req, res) => {
    await GameLevel.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});

app.post('/api/register', async (req, res) => {
    const { firstName, lastName, classroom, password } = req.body; 
    if (firstName?.toLowerCase() === "jean" && password === "Clemenceau1919") {
        return res.json({ ok: true, id: "prof", firstName: "Jean", lastName: "Vuillet", classroom: "Professeur" });
    }
    const match = await Player.findOne({ firstName, lastName, classroom });
    if (match) res.json({ ok: true, id: match._id, firstName, lastName, classroom });
    else res.status(404).json({ ok: false });
});

app.post('/api/reset-player', async (req, res) => {
    await Player.findByIdAndUpdate(req.body.playerId, { spellingMistakes: [] });
    res.json({ ok: true });
});

app.listen(port, () => console.log(`🚀 Serveur prêt port ${port}`));