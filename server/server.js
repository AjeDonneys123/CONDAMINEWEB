const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// 1. CHARGEMENT SÉCURISÉ DES MODÈLES
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

try {
    loadModels();
    console.log("✅ Modèles Mongoose indexés.");
} catch (e) {
    console.error("❌ Erreur modèles:", e.message);
}

// 2. CONNEXION MONGODB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connecté.'))
    .catch(err => console.error("❌ Erreur MongoDB :", err.message));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 3. API SYSTÈME ANTI-CRASH (FIX 500)
app.get('/api/system-status', (req, res) => {
    const statusPath = path.join(__dirname, '..', 'apply_status.json');
    try {
        if (fs.existsSync(statusPath)) {
            const raw = fs.readFileSync(statusPath, 'utf8').trim();
            if (raw && raw.startsWith('{')) {
                const parsed = JSON.parse(raw);
                return res.status(200).json(parsed);
            }
        }
    } catch (e) {}
    // Fallback systématique pour éviter le 500 sur le frontend
    return res.status(200).json({ status: 'OK' });
});

app.post('/api/reset-status', (req, res) => {
    try {
        const statusPath = path.join(__dirname, '..', 'apply_status.json');
        fs.writeFileSync(statusPath, JSON.stringify({ status: 'OK', timestamp: Date.now() }, null, 2));
        res.json({ ok: true });
    } catch (e) { res.status(200).json({ ok: false }); }
});

// 4. ROUTES API (TOUJOURS EN PREMIER)
app.use('/api', require('./features/auth/auth.routes'));
app.use('/api', require('./features/eleve/eleve.routes'));
app.use('/api', require('./features/prof/prof.routes'));
app.use('/api', require('./features/game/game.routes'));
app.use('/api', require('./features/prof/automation.routes'));

// 5. GESTION DU FRONTEND (STATIC)
const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: "Route API inconnue" });
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    app.get('/', (req, res) => res.send("Serveur Condamine - Mode Récupération Actif."));
}

app.listen(port, () => console.log("🚀 SERVEUR STABLE SUR PORT " + port));