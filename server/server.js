const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// 1. Connexion BDD
mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('✅ BDD Connectée.');
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

        try {
            const vPath = path.join(__dirname, 'version.json');
            if (fs.existsSync(vPath)) {
                const vData = JSON.parse(fs.readFileSync(vPath, 'utf8'));
                await DeploySignal.findOneAndUpdate({}, { build: vData.build, status: 'live', updatedAt: new Date() }, { upsert: true });
            }
        } catch (e) {}
    })
    .catch(err => console.error("❌ Erreur MongoDB :", err));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- ROUTE SPECIALE POUR LE STATUT D'APPLICATION DU CODE ---
app.get('/api/system-status', (req, res) => {
    const statusPath = path.join(__dirname, '..', 'apply_status.json');
    if (fs.existsSync(statusPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
            res.json(data);
        } catch (e) { res.json({ status: 'OK' }); }
    } else {
        res.json({ status: 'OK' });
    }
});

// 2. Routes API
app.use('/api', require('./features/auth/auth.routes'));
app.use('/api', require('./features/eleve/eleve.routes'));
app.use('/api', require('./features/prof/prof.routes'));
app.use('/api', require('./features/game/game.routes'));
app.use('/api', require('./features/prof/automation.routes'));

// 3. Frontend
const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: "API 404" });
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    app.get('/', (req, res) => res.send("Serveur API Condamine actif."));
}

app.listen(port, () => console.log(`🚀 SERVEUR PRÊT : ${port}`));