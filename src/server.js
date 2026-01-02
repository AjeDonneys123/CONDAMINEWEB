const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const nodeFetch = require('node-fetch');
if (!global.fetch) { global.fetch = nodeFetch; }

const express = require('express');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 3000;

// 1. Initialiser les Modèles
require('../server/models/Schemas');

// 2. Connexion BDD
mongoose.connect(process.env.MONGODB_URI).then(() => console.log('✅ BDD Connectée')).catch(console.error);

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// 3. Charger les Routes Modulaires
const eleveRoutes = require('../server/features/eleve/eleve.routes');
const profRoutes = require('../server/features/prof/prof.routes');

app.use('/api', eleveRoutes);
app.use('/api', profRoutes);

// AUTH
app.post('/api/register', async (req, res) => {
    const Player = mongoose.model('Player');
    const { firstName, lastName, classroom, password } = req.body;
    if (firstName?.toLowerCase() === "jean" && password === "Clemenceau1919") return res.json({ ok: true, id: "prof", firstName: "Jean", lastName: "Vuillet", classroom: "Professeur" });
    if (firstName?.toLowerCase() === "eleve" && lastName?.toLowerCase() === "test") {
        let testP = await Player.findOne({ firstName: "Eleve", lastName: "Test", classroom });
        if (!testP) testP = await new Player({ firstName: "Eleve", lastName: "Test", classroom }).save();
        return res.json({ ok: true, id: testP._id, firstName: "Eleve", lastName: "Test", classroom });
    }
    const match = await Player.findOne({ firstName, lastName, classroom });
    if (match) res.json({ ok: true, id: match._id, firstName, lastName, classroom });
    else res.status(404).json({ ok: false });
});

app.listen(port, () => console.log(`🚀 Serveur Feature-Based V8.1 prêt sur port ${port}`));