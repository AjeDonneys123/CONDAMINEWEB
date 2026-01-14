const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');

// Injection globale de fetch pour Node < 18 (Fix Gemini)
if (!global.fetch) {
    global.fetch = require('node-fetch');
}

const app = express();
const port = process.env.PORT || 3000;
const SERVER_BOOT_ID = Date.now();

/**
 * 1. ENREGISTREMENT PRIORITAIRE DES MODÈLES (ORDRE ALPHABÉTIQUE)
 * Indispensable pour éviter les erreurs "Schema hasn't been registered" (Erreur 500).
 */
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
    console.log('✅ MongoDB Connecté.');
    try {
        const DeploySignal = mongoose.model('DeploySignal');
        await DeploySignal.findOneAndUpdate({}, { status: 'live', updatedAt: new Date() }, { upsert: true });
    } catch (e) {
        console.warn("⚠️ Signal de déploiement non mis à jour.");
    }
}).catch(err => {
    console.error("❌ Erreur fatale de connexion MongoDB :", err.message);
});

// MIDDLEWARES DE PARSING
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

/**
 * 3. ROUTES SYSTÈME (BOOT & MONITORING)
 */
app.get('/api/check-deploy', (req, res) => {
    res.json({ bootId: SERVER_BOOT_ID });
});

app.get('/api/deploy-status', async (req, res) => {
    try {
        const sig = await mongoose.model('DeploySignal').findOne();
        const v = JSON.parse(fs.readFileSync(path.join(__dirname, 'version.json'), 'utf8'));
        res.json({ version: v.version, build: v.build, status: sig?.status || 'live' });
    } catch (e) { 
        res.json({ version: '1.0.0', build: 0, status: 'live' }); 
    }
});

/**
 * 4. ARCHITECTURE PAR DOMAINE (ZÉRO POROSITÉ)
 */
app.use('/api/auth', require('./features/auth/auth.routes'));
app.use('/api/games', require('./features/games/games.routes'));
app.use('/api/scans', require('./features/scans/scans.routes'));
app.use('/api/homework', require('./features/homework/homework.routes'));

// DOMAINE ADMIN : Monté sur /api pour capturer /api/players, /api/chapters-all etc.
app.use('/api', require('./features/admin/admin.routes')); 

/**
 * 5. GESTION DU FRONTEND (PRODUCTION)
 */
const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) {
            return res.status(404).json({ error: "Route API introuvable : " + req.path });
        }
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(port, () => {
    console.log(`-----------------------------------------------`);
    console.log(`🚀 SERVEUR CONDAMINE PRÊT SUR LE PORT ${port}`);
    console.log(`🆔 BOOT ID : ${SERVER_BOOT_ID}`);
    console.log(`-----------------------------------------------`);
});