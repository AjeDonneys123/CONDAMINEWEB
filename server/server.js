const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const SERVER_BOOT_ID = Date.now();

// 1. CHARGEMENT DES MODÈLES (CRITIQUE)
const models = ['./models/Teacher', './models/Player', './models/Chapter', './models/Homework', './models/GameLevel', './models/Bug', './models/Submission', './models/TeacherStyle', './models/ScanSession', './models/DeploySignal'];
models.forEach(m => { try { require(m); } catch (e) { console.error("Erreur modèle:", m); } });

// 2. CONNEXION MONGODB
mongoose.connect(process.env.MONGODB_URI).then(async () => {
    console.log('✅ MongoDB Connected.');
    try {
        await mongoose.model('DeploySignal').findOneAndUpdate({}, { status: 'live', updatedAt: new Date() }, { upsert: true });
    } catch (e) {}
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 3. ROUTES SYSTÈME
app.get('/api/check-deploy', (req, res) => res.json({ bootId: SERVER_BOOT_ID }));
app.get('/api/deploy-status', async (req, res) => {
    try {
        const signal = await mongoose.model('DeploySignal').findOne({});
        const version = JSON.parse(fs.readFileSync(path.join(__dirname, 'version.json'), 'utf8'));
        res.json({ status: signal?.status || 'live', build: version.build, version: version.version });
    } catch (e) { res.json({ status: 'live', build: 176 }); }
});
app.get('/api/system-status', (req, res) => res.json({ status: 'OK' }));

// 4. ROUTES API (FEATURES) - ENREGISTREMENT EXPLICITE
app.use('/api', require('./features/auth/auth.routes'));
app.use('/api', require('./features/eleve/eleve.routes'));
app.use('/api', require('./features/prof/prof.routes'));
app.use('/api', require('./features/game/game.routes'));
app.use('/api', require('./features/prof/automation.routes'));

// Garde-fou 404 API
app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `Route API introuvable : ${req.method} ${req.url}` });
});

// 5. GESTION FRONTEND
const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(port, () => console.log(`🚀 SERVEUR CONDAMINE PRÊT [PORT:${port}]`));