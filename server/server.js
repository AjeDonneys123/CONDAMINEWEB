const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');

// Injection globale de fetch pour Gemini & Drive (Node < 18)
if (!global.fetch) { 
    global.fetch = require('node-fetch'); 
}

const app = express();
const port = process.env.PORT || 3000;
const SERVER_BOOT_ID = Date.now();

// 1. CHARGEMENT DES MODÈLES (ORDRE ALPHABÉTIQUE POUR LA CLARTÉ)
// Chaque require enregistre le modèle dans Mongoose
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
    const dbName = mongoose.connection.name;
    console.log(`✅ MongoDB Connecté : ${dbName}`);
    try {
        // Signal de vie pour l'Auto-Refresh (User Story #13)
        await mongoose.model('DeploySignal').findOneAndUpdate({}, { status: 'live', updatedAt: new Date() }, { upsert: true });
    } catch (e) {}
}).catch(err => console.error("❌ MongoDB Error:", err.message));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 3. ROUTES SYSTÈME
app.get('/api/check-deploy', (req, res) => res.json({ bootId: SERVER_BOOT_ID }));
app.get('/api/deploy-status', async (req, res) => {
    try {
        const sig = await mongoose.model('DeploySignal').findOne();
        const v = JSON.parse(fs.readFileSync(path.join(__dirname, 'version.json'), 'utf8'));
        res.json({ version: v.version, build: v.build, status: sig?.status || 'live' });
    } catch (e) { res.json({ version: '1.0.0', build: 0, status: 'live' }); }
});

// 4. ARCHITECTURE PAR DOMAINE (ZÉRO POROSITÉ)
// Chaque route est un tiroir étanche
app.use('/api/auth', require('./features/auth/auth.routes'));
app.use('/api/games', require('./features/games/games.routes'));
app.use('/api/scans', require('./features/scans/scans.routes'));
app.use('/api/homework', require('./features/homework/homework.routes'));
app.use('/api/upload', require('./features/upload/upload.routes'));
app.use('/api', require('./features/admin/admin.routes')); 

// 5. GESTION FRONTEND (PRODUCTION)
const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        // Sécurité : ne pas renvoyer de HTML pour une erreur API
        if (req.path.startsWith('/api')) return res.status(404).json({ error: "Route API introuvable" });
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(port, () => {
    console.log(`🚀 SERVEUR CONDAMINE V2 PRÊT`);
    console.log(`📡 PORT : ${port}`);
    console.log(`🧠 IA : GEMINI 2.0 FLASH`);
});