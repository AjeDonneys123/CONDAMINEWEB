const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// 1. CHARGEMENT DES MODÈLES DANS L'ORDRE (CRITIQUE)
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

// 2. CONNEXION MONGODB AVEC OPTIONS ROBUSTES
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    console.log('✅ MongoDB Connecté avec succès.');
    // Signal de déploiement
    try {
        const vPath = path.join(__dirname, 'version.json');
        if (fs.existsSync(vPath)) {
            const vData = JSON.parse(fs.readFileSync(vPath, 'utf8'));
            await DeploySignal.findOneAndUpdate({}, { 
                build: vData.build, 
                status: 'live', 
                updatedAt: new Date() 
            }, { upsert: true });
        }
    } catch (e) { console.warn("⚠️ Signal skip."); }
}).catch(err => {
    console.error("❌ ERREUR CONNEXION MONGODB :", err.message);
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 3. API SYSTÈME BLINDÉE (EMPECHE LES 500 SUR LE FRONT)
app.get('/api/system-status', (req, res) => {
    try {
        const statusPath = path.join(__dirname, '..', 'apply_status.json');
        if (fs.existsSync(statusPath)) {
            const raw = fs.readFileSync(statusPath, 'utf8');
            if (!raw || raw.trim() === "" || raw === "undefined") {
                return res.json({ status: 'OK' });
            }
            return res.json(JSON.parse(raw));
        }
        return res.json({ status: 'OK' });
    } catch (e) {
        return res.json({ status: 'OK', error: "Read Error" });
    }
});

app.post('/api/reset-status', (req, res) => {
    try {
        const statusPath = path.join(__dirname, '..', 'apply_status.json');
        fs.writeFileSync(statusPath, JSON.stringify({ status: 'OK', timestamp: Date.now() }, null, 2));
        res.json({ ok: true });
    } catch (e) { res.status(200).json({ ok: false }); }
});

// 4. INCLUSION DES ROUTES
app.use('/api', require('./features/auth/auth.routes'));
app.use('/api', require('./features/eleve/eleve.routes'));
app.use('/api', require('./features/prof/prof.routes'));
app.use('/api', require('./features/game/game.routes'));
app.use('/api', require('./features/prof/automation.routes'));

// 5. REACT INTEGRATION
const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: "API 404" });
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    app.get('/', (req, res) => res.send("SERVEUR CONDAMINE OK (Mode API)"));
}

// Gestion globale des erreurs pour éviter le crash du process
app.use((err, req, res, next) => {
    console.error("🔥 CRASH PREVENU :", err.stack);
    res.status(500).json({ error: "Erreur Interne Serveur", details: err.message });
});

app.listen(port, () => console.log(`🚀 SERVEUR CONDAMINE PRET : http://localhost:${port}`));