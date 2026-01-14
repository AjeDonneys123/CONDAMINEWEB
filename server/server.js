const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const SERVER_BOOT_ID = Date.now();

// 1. CHARGEMENT DES MODÈLES (ABSOLUMENT EN PREMIER)
const loadModels = () => {
    require('./models/Teacher');
    require('./models/Player');
    require('./models/Chapter');
    require('./models/Homework');
    require('./models/GameLevel');
    require('./models/Bug');
    require('./models/Submission');
    require('./models/TeacherStyle');
    require('./models/ScanSession');
    require('./models/DeploySignal');
};
loadModels();

// 2. CONNEXION MONGODB
mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000
}).then(async () => {
    console.log('✅ MongoDB Connecté.');
    try {
        const DeploySignal = mongoose.model('DeploySignal');
        await DeploySignal.findOneAndUpdate({}, { status: 'live', updatedAt: new Date() }, { upsert: true });
    } catch (e) {}
}).catch(err => console.error("❌ Erreur MongoDB :", err.message));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 3. ROUTES SYSTÈME (INDÉSTRUCTIBLES)
app.get('/api/check-deploy', (req, res) => res.json({ bootId: SERVER_BOOT_ID }));
app.get('/api/deploy-status', async (req, res) => {
    try {
        const DeploySignal = mongoose.model('DeploySignal');
        const signal = await DeploySignal.findOne({});
        const version = JSON.parse(fs.readFileSync(path.join(__dirname, 'version.json'), 'utf8'));
        res.json({ status: signal?.status || 'live', build: version.build, version: version.version });
    } catch (e) { res.json({ status: 'live', build: 178 }); }
});
app.get('/api/system-status', (req, res) => res.json({ status: 'OK' }));

// 4. ROUTES API (FEATURES)
app.use('/api', require('./features/auth/auth.routes'));
app.use('/api', require('./features/eleve/eleve.routes'));
app.use('/api', require('./features/prof/prof.routes'));
app.use('/api', require('./features/game/game.routes'));
app.use('/api', require('./features/prof/automation.routes'));

// Garde-fou pour les 404 API
app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `Route API introuvable : ${req.method} ${req.url}` });
});

// 5. GESTION FRONTEND (DANS LE DOSSIER DIST)
const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

// 6. GESTIONNAIRE D'ERREURS GLOBAL (Évite le crash serveur)
app.use((err, req, res, next) => {
    console.error("🔥 ERREUR SERVEUR INTERCEPTÉE :", err.message);
    res.status(500).json({ error: "Erreur interne", details: err.message });
});

app.listen(port, () => console.log(`🚀 SERVEUR CONDAMINE OK [PORT:${port}]`));