const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

console.log("------------------------------------------------");
console.log("🚀 DÉPLOIEMENT CONDAMINE V12...");

// 1. Connexion BDD
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ BDD Connectée.'))
    .catch(err => console.error("❌ Erreur MongoDB :", err));

// 2. Middlewares
app.use(express.json());

// 3. Modèles
require('./models/Player');
require('./models/Chapter');
require('./models/Homework');
require('./models/GameLevel');
require('./models/Bug');
require('./models/Submission');

// 4. Routes API
app.use('/api', require('./features/auth/auth.routes'));
app.use('/api', require('./features/eleve/eleve.routes'));
app.use('/api', require('./features/prof/prof.routes'));
app.use('/api', require('./features/game/game.routes'));
app.use('/api', require('./features/prof/automation.routes'));

// 5. GESTION DU FRONTEND (FIX RENDER)
// On utilise __dirname pour remonter à la racine puis client/dist
const distPath = path.resolve(__dirname, '..', 'client', 'dist');
console.log("🔍 Chemin de déploiement :", distPath);

if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: "API 404" });
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    app.get('*', (req, res) => {
        res.status(500).send(`Le dossier ${distPath} est absent. Vérifiez le log de Build sur Render.`);
    });
}

app.listen(port, () => console.log(`🚀 SERVEUR PRÊT : ${port}`));