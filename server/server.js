const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// 1. CHARGEMENT DES MODÈLES (CRITIQUE : TOUJOURS EN PREMIER)
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
    console.log("✅ Modèles Mongoose chargés.");
} catch (e) {
    console.error("❌ Erreur critique modèles:", e.message);
}

// 2. CONNEXION MONGODB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connecté.'))
    .catch(err => console.error("❌ Erreur MongoDB :", err.message));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 3. API SYSTÈME BLINDÉE (FIX ERREUR 500)
app.get('/api/system-status', (req, res) => {
    try {
        const statusPath = path.join(__dirname, '..', 'apply_status.json');
        if (fs.existsSync(statusPath)) {
            const raw = fs.readFileSync(statusPath, 'utf8').trim();
            if (raw && raw.startsWith('{')) {
                const parsed = JSON.parse(raw);
                return res.status(200).json(parsed);
            }
        }
    } catch (e) {
        console.error("Erreur lecture status:", e.message);
    }
    // Réponse par défaut en cas de fichier manquant ou corrompu
    res.status(200).json({ status: 'OK' });
});

app.post('/api/reset-status', (req, res) => {
    try {
        const statusPath = path.join(__dirname, '..', 'apply_status.json');
        fs.writeFileSync(statusPath, JSON.stringify({ status: 'OK', timestamp: Date.now() }, null, 2));
        res.json({ ok: true });
    } catch (e) { res.status(200).json({ ok: false }); }
});

// 4. ROUTES API
app.use('/api', require('./features/auth/auth.routes'));
app.use('/api', require('./features/eleve/eleve.routes'));
app.use('/api', require('./features/prof/prof.routes'));
app.use('/api', require('./features/game/game.routes'));
app.use('/api', require('./features/prof/automation.routes'));

// 5. GESTION DU FRONTEND
const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: "404" });
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    app.get('/', (req, res) => res.send("Serveur Condamine - Prêt."));
}

// Global Error Handler
app.use((err, req, res, next) => {
    console.error("🔥 ERREUR SERVEUR INTERCEPTÉE :", err.message);
    res.status(500).json({ status: 'ERROR', message: err.message });
});

app.listen(port, () => console.log("🚀 SERVEUR DÉMARRÉ SUR PORT " + port));