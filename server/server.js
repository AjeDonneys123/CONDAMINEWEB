const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// 1. CHARGEMENT PRIORITAIRE DES MODÈLES (Empêche le crash "Schema not registered")
const Teacher = require('./models/Teacher');
const Player = require('./models/Player');
const Chapter = require('./models/Chapter');
const Homework = require('./models/Homework');
const GameLevel = require('./models/GameLevel');
const Bug = require('./models/Bug');
const Submission = require('./models/Submission');
const TeacherStyle = require('./models/TeacherStyle');
const ScanSession = require('./models/ScanSession');
const DeploySignal = require('./models/DeploySignal');

// 2. CONNEXION MONGODB
mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('✅ MongoDB Connecté.');
        try {
            const vPath = path.join(__dirname, 'version.json');
            if (fs.existsSync(vPath)) {
                const vData = JSON.parse(fs.readFileSync(vPath, 'utf8'));
                await mongoose.model('DeploySignal').findOneAndUpdate({}, { build: vData.build, status: 'live', updatedAt: new Date() }, { upsert: true });
            }
        } catch (e) {}
    })
    .catch(err => console.error("❌ Erreur Connexion MongoDB :", err));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 3. API SYSTÈME ULTRA-SÉCURISÉE (Empêche l'erreur 500 sur le front)
app.get('/api/system-status', (req, res) => {
    try {
        const statusPath = path.join(__dirname, '..', 'apply_status.json');
        if (fs.existsSync(statusPath)) {
            const content = fs.readFileSync(statusPath, 'utf8');
            if (!content || content.trim() === "" || content === "undefined") {
                return res.status(200).json({ status: 'OK' });
            }
            return res.status(200).json(JSON.parse(content));
        }
        return res.status(200).json({ status: 'OK' });
    } catch (e) {
        return res.status(200).json({ status: 'OK', warning: "Internal recovery" });
    }
});

app.post('/api/reset-status', (req, res) => {
    try {
        const statusPath = path.join(__dirname, '..', 'apply_status.json');
        fs.writeFileSync(statusPath, JSON.stringify({ status: 'OK', timestamp: Date.now() }, null, 2));
        res.json({ ok: true });
    } catch (e) { res.status(200).json({ ok: false }); }
});

// 4. ROUTES API (Chargées APRES les modèles)
app.use('/api', require('./features/auth/auth.routes'));
app.use('/api', require('./features/eleve/eleve.routes'));
app.use('/api', require('./features/prof/prof.routes'));
app.use('/api', require('./features/game/game.routes'));
app.use('/api', require('./features/prof/automation.routes'));

// 5. INTÉGRATION REACT
const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: "404" });
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    app.get('/', (req, res) => res.send("Serveur Condamine API Ready."));
}

app.listen(port, () => console.log(`🚀 SERVEUR DÉMARRÉ SUR PORT ${port}`));