const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// 1. CHARGEMENT DES MODÈLES (ORDRE CRITIQUE)
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

// 2. CONNEXION BDD
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connecté.'))
    .catch(err => console.error("❌ Erreur MongoDB :", err));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 3. API SYSTÈME (SÉCURITÉ ANTI-CRASH)
app.get('/api/system-status', (req, res) => {
    const statusPath = path.join(__dirname, '..', 'apply_status.json');
    try {
        if (fs.existsSync(statusPath)) {
            const raw = fs.readFileSync(statusPath, 'utf8');
            return res.json(raw ? JSON.parse(raw) : { status: 'OK' });
        }
    } catch (e) {}
    res.json({ status: 'OK' });
});

app.post('/api/reset-status', (req, res) => {
    try {
        const statusPath = path.join(__dirname, '..', 'apply_status.json');
        fs.writeFileSync(statusPath, JSON.stringify({ status: 'OK', timestamp: Date.now() }, null, 2));
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. ROUTES API
app.use('/api', require('./features/auth/auth.routes'));
app.use('/api', require('./features/eleve/eleve.routes'));
app.use('/api', require('./features/prof/prof.routes'));
app.use('/api', require('./features/game/game.routes'));
app.use('/api', require('./features/prof/automation.routes'));

// 5. STATICS
const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: "Not Found" });
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(port, () => console.log(`🚀 SERVEUR PRET : ${port}`));