const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');

// US #13 : Chargement .env AVANT tout le reste pour que DriveService lise les variables
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

if (!global.fetch) { global.fetch = require('node-fetch'); }

const app = express();
const port = process.env.PORT || 3000;
const SERVER_BOOT_ID = Date.now();

// 1. MODÈLES
const modelsPath = path.join(__dirname, 'models');
fs.readdirSync(modelsPath).forEach(file => { if (file.endsWith('.js')) require(path.join(modelsPath, file)); });

// 2. MONGODB
mongoose.connect(process.env.MONGODB_URI).then(async () => {
    console.log('✅ MongoDB Connecté.');
    try { await mongoose.model('DeploySignal').findOneAndUpdate({}, { status: 'live', updatedAt: new Date() }, { upsert: true }); } catch (e) {}
}).catch(err => console.error("❌ MongoDB Error:", err.message));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 3. ROUTES
app.get('/api/check-deploy', (req, res) => res.json({ bootId: SERVER_BOOT_ID }));
app.get('/api/deploy-status', async (req, res) => {
    try {
        const sig = await mongoose.model('DeploySignal').findOne();
        res.json({ version: "1.8.5", build: 285, status: sig?.status || 'live' });
    } catch (e) { res.json({ status: 'live' }); }
});

app.use('/api/auth', require('./features/auth/auth.routes'));
app.use('/api/games', require('./features/games/games.routes'));
app.use('/api/scans', require('./features/scans/scans.routes'));
app.use('/api/homework', require('./features/homework/homework.routes'));
app.use('/api', require('./features/admin/admin.routes')); 

// 4. FRONTEND
const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).send("API 404");
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(port, () => console.log(`🚀 SERVEUR ACTIF | PORT ${port}`));