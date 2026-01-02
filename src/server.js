const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const nodeFetch = require('node-fetch');
if (!global.fetch) { global.fetch = nodeFetch; }

const express = require('express');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI;

// --- 1. MODÈLES ---
const Player = mongoose.model('Player', new mongoose.Schema({ 
    firstName: String, lastName: String, classroom: String, spellingMistakes: { type: Array, default: [] } 
}));

const Homework = mongoose.model('Homework', new mongoose.Schema({ 
    title: String, classroom: String, levels: Array, date: { type: Date, default: Date.now } 
}));

mongoose.connect(mongoUri).then(() => console.log('✅ MongoDB Connecté')).catch(err => console.error(err));

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- 2. ROUTES ---

// Route Register / Login (FIX TESTER CLASSE)
app.post('/api/register', async (req, res) => {
    const { firstName, lastName, classroom, password } = req.body;
    
    // Cas Prof
    if (firstName?.toLowerCase() === "jean" && password === "Clemenceau1919") {
        return res.json({ ok: true, id: "prof", firstName: "Jean", lastName: "Vuillet", classroom: "Professeur" });
    }

    // Cas Eleve Test
    if (firstName?.toLowerCase() === "eleve" && lastName?.toLowerCase() === "test") {
        let testP = await Player.findOne({ firstName: "Eleve", lastName: "Test", classroom });
        if (!testP) testP = new Player({ firstName: "Eleve", lastName: "Test", classroom });
        await testP.save();
        return res.json({ ok: true, id: testP._id, firstName: "Eleve", lastName: "Test", classroom });
    }

    // Cas Élève Normal
    const match = await Player.findOne({ firstName, lastName, classroom });
    if (match) res.json({ ok: true, id: match._id, firstName, lastName, classroom });
    else res.status(404).json({ ok: false, message: "Élève non trouvé" });
});

// Route Homeworks Élève
app.get('/api/homework/:classroom', async (req, res) => {
    try {
        const cls = req.params.classroom;
        const list = await Homework.find({ $or: [{ classroom: cls }, { classroom: "Toutes" }] }).sort({ date: -1 });
        res.json(list);
    } catch (e) { res.status(500).json([]); }
});

app.get('/api/players', async (req, res) => {
    const list = await Player.find().sort({ classroom: 1, lastName: 1 });
    res.json(list);
});

app.listen(port, () => console.log(`🚀 Serveur prêt port ${port}`));