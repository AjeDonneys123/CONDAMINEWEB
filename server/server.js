const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const dotenv = require('dotenv');

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
if (!global.fetch) global.fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 3000;
const SERVER_BOOT_ID = Date.now();

// 1. CHARGEMENT DES MODÈLES
require('./models/Teacher'); require('./models/Player'); require('./models/Chapter');
require('./models/Homework'); require('./models/GameLevel'); require('./models/ScanSession');
require('./models/Submission'); require('./models/TeacherStyle'); require('./models/DeploySignal');
require('./models/Bug');

mongoose.connect(process.env.MONGODB_URI).then(() => console.log('✅ MongoDB Connected (Build 336)'));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 2. ROUTES API
app.use('/api/auth', require('./features/auth/auth.routes'));
app.use('/api/structure', require('./features/structure/structure.routes'));
app.use('/api/games', require('./features/games/games.routes'));
app.use('/api/homework', require('./features/homework/homework.routes'));
app.use('/api/scans', require('./features/scans/scans.routes'));
app.use('/api', require('./features/admin/admin.routes'));

const DriveService = require('./services/drive.service');
app.get('/api/drive-check', async (req, res) => {
    try {
        const status = await DriveService.testConnection();
        res.json(status);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/api/check-deploy', (req, res) => res.json({ bootId: SERVER_BOOT_ID }));
app.get('/api/deploy-status', (req, res) => res.json({ version: "2.3.6", build: 336, status: "live" }));

const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(port, () => console.log(`🚀 SERVEUR CONDAMINE ACTIF (BUILD 336)`));