// --- ÉTAPE 0 : CHARGEMENT DU .ENV AVANT TOUT LE RESTE ---
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (result.error) {
        console.error("❌ [ENV] Erreur de parsing du fichier .env");
    } else {
        console.log("✅ [ENV] Fichier chargé avec succès.");
    }
} else {
    console.error("❌ [ENV] FICHIER .ENV INTROUVABLE !");
}

// Vérification immédiate
console.log("🔑 [CONFIG] ID Client détecté :", process.env.GOOGLE_CLIENT_ID ? "OUI (OK)" : "NON (VIDE)");

const express = require('express');
const mongoose = require('mongoose');

if (!global.fetch) { global.fetch = require('node-fetch'); }

const app = express();
const port = process.env.PORT || 3000;
const SERVER_BOOT_ID = Date.now();

// 1. MODÈLES
require('./models/Teacher');
require('./models/Player');
require('./models/Chapter');
require('./models/Homework');
require('./models/GameLevel');
require('./models/ScanSession');
require('./models/Submission');
require('./models/Bug');
require('./models/DeploySignal');
require('./models/TeacherStyle');

// 2. MONGODB
mongoose.connect(process.env.MONGODB_URI).then(async () => {
    console.log('✅ MongoDB Connecté.');
    try { await mongoose.model('DeploySignal').findOneAndUpdate({}, { status: 'live', updatedAt: new Date() }, { upsert: true }); } catch (e) {}
}).catch(err => console.error("❌ MongoDB Error:", err.message));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 3. ROUTES
app.use('/api/auth', require('./features/auth/auth.routes'));
app.use('/api/games', require('./features/games/games.routes'));
app.use('/api/scans', require('./features/scans/scans.routes'));
app.use('/api/homework', require('./features/homework/homework.routes'));
app.use('/api', require('./features/admin/admin.routes')); 

app.get('/api/check-deploy', (req, res) => res.json({ bootId: SERVER_BOOT_ID }));
app.get('/api/deploy-status', (req, res) => res.json({ version: "2.1.0", build: 310, status: "live" }));

// 4. FRONTEND
const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).send("API NOT FOUND");
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(port, () => console.log(`🚀 SERVEUR CONDAMINE ACTIF | PORT ${port}`));