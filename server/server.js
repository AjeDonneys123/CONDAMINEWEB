const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// --- 1. ENREGISTREMENT DES MODÈLES (DOIT ÊTRE AU DÉBUT) ---
require('./models/Teacher');
require('./models/Player');
require('./models/Chapter');
require('./models/Homework');
require('./models/GameLevel');
require('./models/Bug');
require('./models/Submission');
require('./models/TeacherStyle');
require('./models/ScanSession');
const DeploySignal = require('./models/DeploySignal');

// --- 2. CONNEXION BDD ---
mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('✅ BDD Connectée.');
        try {
            const vPath = path.join(__dirname, 'version.json');
            if (fs.existsSync(vPath)) {
                const vData = JSON.parse(fs.readFileSync(vPath, 'utf8'));
                await DeploySignal.findOneAndUpdate({}, { build: vData.build, status: 'live', updatedAt: new Date() }, { upsert: true });
            }
        } catch (e) { console.error("Erreur Signal:", e.message); }
    })
    .catch(err => console.error("❌ Erreur MongoDB :", err));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- 3. API SYSTÈME (SÉCURISÉE CONTRE LES 500) ---
app.get('/api/system-status', (req, res) => {
    try {
        const statusPath = path.join(__dirname, '..', 'apply_status.json');
        if (fs.existsSync(statusPath)) {
            const content = fs.readFileSync(statusPath, 'utf8');
            if (!content.trim()) return res.json({ status: 'OK' });
            return res.json(JSON.parse(content));
        }
        res.json({ status: 'OK' });
    } catch (e) {
        res.json({ status: 'OK', error: "Parse error" });
    }
});

app.post('/api/reset-status', (req, res) => {
    const statusPath = path.join(__dirname, '..', 'apply_status.json');
    try {
        fs.writeFileSync(statusPath, JSON.stringify({ status: 'OK', timestamp: Date.now() }, null, 2));
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- 4. ROUTES API ---
app.use('/api', require('./features/auth/auth.routes'));
app.use('/api', require('./features/eleve/eleve.routes'));
app.use('/api', require('./features/prof/prof.routes'));
app.use('/api', require('./features/game/game.routes'));
app.use('/api', require('./features/prof/automation.routes'));

// --- 5. SERVEUR FRONTEND ---
const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: "API 404" });
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    app.get('/', (req, res) => res.send("Serveur Condamine actif (Mode API)"));
}

app.listen(port, () => console.log(`🚀 SERVEUR PRÊT SUR PORT ${port}`));