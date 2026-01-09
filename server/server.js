const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

console.log("------------------------------------------------");
console.log("🚀 Lancement du Serveur Condamine...");

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

// 5. GESTION DU FRONTEND
const distPath = path.join(process.cwd(), 'client', 'dist');

if (fs.existsSync(distPath)) {
    console.log("✅ Mode Production : Dossier 'dist' servi.");
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: "API 404" });
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    // En développement (Mac), c'est normal que dist n'existe pas.
    console.log("ℹ️  Mode Développement : Le serveur API est prêt.");
    app.get('/', (req, res) => res.send("Serveur API Condamine actif. Le Frontend est géré par Vite."));
}

app.listen(port, () => console.log(`🚀 SERVEUR PRÊT : http://localhost:${port}`));