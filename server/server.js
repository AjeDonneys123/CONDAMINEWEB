const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// 1. CHARGEMENT DES MODÈLES
const models = [
    './models/Teacher', './models/Player', './models/Chapter', 
    './models/Homework', './models/GameLevel', './models/Bug', 
    './models/Submission', './models/TeacherStyle', './models/ScanSession', 
    './models/DeploySignal'
];
models.forEach(m => { try { require(m); } catch (e) { console.error("Erreur modèle:", m); } });

// 2. CONNEXION MONGODB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connecté.'))
    .catch(err => console.error("❌ Erreur MongoDB :", err.message));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 3. ROUTES SYSTÈME (STATUT + VERSION)
app.get('/api/system-status', (req, res) => {
    res.status(200).json({ status: 'OK' });
});

app.get('/api/app-version', (req, res) => {
    try {
        const v = JSON.parse(fs.readFileSync(path.join(__dirname, 'version.json'), 'utf8'));
        res.json(v);
    } catch (e) { res.json({ version: "1.0.0", build: 0 }); }
});

// 4. ROUTES API (ORDRE CRITIQUE)
app.use('/api', require('./features/auth/auth.routes'));
app.use('/api', require('./features/eleve/eleve.routes'));
app.use('/api', require('./features/prof/prof.routes'));
app.use('/api', require('./features/game/game.routes'));
app.use('/api', require('./features/prof/automation.routes'));

// 5. GARDE-FOU API
app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `Route API inexistante : ${req.method} ${req.originalUrl}` });
});

// 6. FRONTEND
const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
} else {
    app.get('/', (req, res) => res.send("Serveur Condamine - Prêt."));
}

app.listen(port, () => console.log("🚀 SERVEUR DÉMARRÉ SUR PORT " + port));