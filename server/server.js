const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const SERVER_BOOT_ID = Date.now();

// 1. CHARGEMENT DES MODÈLES (DOIT ÊTRE FAIT AVANT LES ROUTES)
try {
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
    console.log("✅ Modèles indexés.");
} catch (e) {
    console.error("❌ Erreur Modèles:", e.message);
}

// 2. CONNEXION MONGODB AVEC TIMEOUT SÉCURISÉ
mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000
}).then(async () => {
    console.log('✅ MongoDB Connecté.');
    try {
        const DeploySignal = mongoose.model('DeploySignal');
        await DeploySignal.findOneAndUpdate({}, { status: 'live', updatedAt: new Date() }, { upsert: true });
    } catch (e) {}
}).catch(err => console.error("❌ Erreur Critique MongoDB :", err.message));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 3. ROUTES SYSTÈME (INDÉSTRUCTIBLES)
app.get('/api/check-deploy', (req, res) => res.json({ bootId: SERVER_BOOT_ID }));

app.get('/api/deploy-status', async (req, res) => {
    try {
        const DeploySignal = mongoose.model('DeploySignal');
        const signal = await DeploySignal.findOne({});
        const vPath = path.join(__dirname, 'version.json');
        let v = { build: 172, version: "1.3.12" };
        if (fs.existsSync(vPath)) v = JSON.parse(fs.readFileSync(vPath, 'utf8'));
        res.json({ status: signal?.status || 'live', build: v.build, version: v.version });
    } catch (e) { res.json({ status: 'live', build: 172 }); }
});

app.get('/api/system-status', (req, res) => res.json({ status: 'OK' }));

// 4. ROUTES FEATURES (API)
app.use('/api', require('./features/auth/auth.routes'));
app.use('/api', require('./features/eleve/eleve.routes'));
app.use('/api', require('./features/prof/prof.routes'));
app.use('/api', require('./features/game/game.routes'));
app.use('/api', require('./features/prof/automation.routes'));

// 5. GARDE-FOU API : Toujours répondre en JSON sur /api/*
app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `Route API inexistante : ${req.method} ${req.url}` });
});

// 6. GESTION FRONTEND
const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
} else {
    app.get('/', (req, res) => res.send("Serveur actif (En attente du build client)"));
}

// 7. GESTION DES ERREURS GLOBALES (Empêche le 500 HTML)
app.use((err, req, res, next) => {
    console.error("🔥 Erreur Interne:", err.message);
    res.status(500).json({ error: "Erreur interne du serveur" });
});

app.listen(port, () => console.log(`🚀 SERVEUR SUR PORT ${port}`));