const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');

// Injection globale de fetch pour Gemini (Node < 18)
if (!global.fetch) { global.fetch = require('node-fetch'); }

const app = express();
const port = process.env.PORT || 3000;
const SERVER_BOOT_ID = Date.now();

// 1. CHARGEMENT DES MODÈLES (ORDRE ALPHABÉTIQUE)
require('./models/Bug');
require('./models/Chapter');
require('./models/DeploySignal');
require('./models/GameLevel');
require('./models/Homework');
require('./models/Player');
require('./models/ScanSession');
require('./models/Submission');
require('./models/Teacher');
require('./models/TeacherStyle');

// 2. CONNEXION MONGODB
mongoose.connect(process.env.MONGODB_URI).then(async () => {
    console.log('✅ MongoDB Connected.');
    try {
        await mongoose.model('DeploySignal').findOneAndUpdate({}, { status: 'live', updatedAt: new Date() }, { upsert: true });
    } catch (e) {}
}).catch(err => console.error("❌ MongoDB Error:", err.message));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 3. ROUTES SYSTÈME (STABILISATION 500)
app.get('/api/check-deploy', (req, res) => res.json({ bootId: SERVER_BOOT_ID }));
app.get('/api/deploy-status', async (req, res) => {
    try {
        const sig = await mongoose.model('DeploySignal').findOne();
        // Correction du chemin pour version.json (situé dans le même dossier que server.js)
        const vPath = path.join(__dirname, 'version.json');
        let v = { version: "1.6.0", build: 0 };
        if (fs.existsSync(vPath)) v = JSON.parse(fs.readFileSync(vPath, 'utf8'));
        res.json({ version: v.version, build: v.build, status: sig?.status || 'live' });
    } catch (e) { 
        res.json({ version: '1.6.0', build: 0, status: 'live' }); 
    }
});

// 4. ARCHITECTURE PAR DOMAINE (ZÉRO POROSITÉ)
app.use('/api/auth', require('./features/auth/auth.routes'));
app.use('/api/games', require('./features/games/games.routes'));
app.use('/api/scans', require('./features/scans/scans.routes'));
app.use('/api/homework', require('./features/homework/homework.routes'));
app.use('/api', require('./features/admin/admin.routes')); // Admin capture /players et /chapters-all

// 5. GESTION FRONTEND
const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: "API non trouvée" });
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(port, () => console.log(`🚀 SERVEUR STABILISÉ | PORT ${port}`));