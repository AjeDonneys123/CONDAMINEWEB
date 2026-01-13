const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const SERVER_BOOT_ID = Date.now();

// 1. ROUTES SYSTÈME (AVANT TOUT LE RESTE - PRIORITÉ ABSOLUE)
app.get('/api/check-deploy', (req, res) => res.json({ bootId: SERVER_BOOT_ID }));

app.get('/api/deploy-status', async (req, res) => {
    try {
        const DeploySignal = mongoose.model('DeploySignal');
        const signal = await DeploySignal.findOne({});
        const version = JSON.parse(fs.readFileSync(path.join(__dirname, 'version.json'), 'utf8'));
        res.json({ status: signal?.status || 'live', build: version.build, version: version.version });
    } catch (e) { res.json({ status: 'live', build: 148 }); }
});

app.get('/api/system-status', (req, res) => res.status(200).json({ status: 'OK' }));

// 2. CHARGEMENT DES MODÈLES
const models = ['./models/Teacher', './models/Player', './models/Chapter', './models/Homework', './models/GameLevel', './models/Bug', './models/Submission', './models/TeacherStyle', './models/ScanSession', './models/DeploySignal'];
models.forEach(m => { try { require(m); } catch (e) {} });

// 3. CONNEXION BDD
mongoose.connect(process.env.MONGODB_URI).then(async () => {
    console.log('✅ MongoDB Connected.');
    try {
        await mongoose.model('DeploySignal').findOneAndUpdate({}, { status: 'live' }, { upsert: true });
    } catch (e) {}
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 4. ROUTES API (FEATURES)
app.use('/api', require('./features/auth/auth.routes'));
app.use('/api', require('./features/eleve/eleve.routes'));
app.use('/api', require('./features/prof/prof.routes'));
app.use('/api', require('./features/game/game.routes'));
app.use('/api', require('./features/prof/automation.routes'));

// Garde-fou 404 API
app.use('/api/*', (req, res) => res.status(404).json({ error: "Route API introuvable" }));

// 5. FRONTEND
const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(port, () => console.log(`🚀 Port ${port} | Boot ${SERVER_BOOT_ID}`));