const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');

// US #13 : Chargement ultra-prioritaire du .env
const dotenv = require('dotenv');
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log("✅ Fichier .env détecté et chargé.");
} else {
    console.error("❌ Fichier .env INTROUVABLE à la racine !");
}

if (!global.fetch) { global.fetch = require('node-fetch'); }

const app = express();
const port = process.env.PORT || 3000;
const SERVER_BOOT_ID = Date.now();

// 1. MODÈLES (Ordre de sécurité)
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

// 3. ROUTES API
app.use('/api/auth', require('./features/auth/auth.routes'));
app.use('/api/games', require('./features/games/games.routes'));
app.use('/api/scans', require('./features/scans/scans.routes'));
app.use('/api/homework', require('./features/homework/homework.routes'));
app.use('/api', require('./features/admin/admin.routes')); 

// 4. SYSTÈME
app.get('/api/check-deploy', (req, res) => res.json({ bootId: SERVER_BOOT_ID }));
app.get('/api/deploy-status', (req, res) => res.json({ version: "1.9.0", build: 290, status: "live" }));

// 5. FRONTEND
const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).send("API NOT FOUND");
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(port, () => console.log(`🚀 SERVEUR ACTIF | PORT ${port}`));