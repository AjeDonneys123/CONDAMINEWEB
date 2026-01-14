const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const SERVER_BOOT_ID = Date.now();

/**
 * 1. ENREGISTREMENT CRITIQUE DES MODÈLES (AVANT LES ROUTES)
 * On charge tous les schémas en mémoire pour éviter les erreurs "Schema hasn't been registered".
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
        // Signal de déploiement pour US #13
        const DeploySignal = mongoose.model('DeploySignal');
        await DeploySignal.findOneAndUpdate({}, { status: 'live', updatedAt: new Date() }, { upsert: true });
    } catch (e) {
        console.warn("⚠️ Impossible de mettre à jour le signal de déploiement.");
    }
}).catch(err => {
    console.error("❌ Erreur fatale MongoDB :", err.message);
    process.exit(1);
});

// MIDDLEWARES
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

// DOMAINE ADMIN : Monté sur /api pour capturer les appels structurels (/api/players, /api/chapters-all)
app.use('/api', require('./features/admin/admin.routes')); 

/**
 * 5. GESTION DU FRONTEND (PRODUCTION)
 */
const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        // Sécurité : Si on demande une API qui n'existe pas, renvoyer JSON, pas HTML
        if (req.path.startsWith('/api')) {
            return res.status(404).json({ error: "Route API introuvable", path: req.path });
        }
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(port, () => {
    console.log(`-----------------------------------------------`);
    console.log(`🚀 SERVEUR CONDAMINE MODULAIRE V2 OPERATIONNEL`);
    console.log(`📡 PORT : ${port}`);
    console.log(`🛠️  BOOT ID : ${SERVER_BOOT_ID}`);
    console.log(`-----------------------------------------------`);
});