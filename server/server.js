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

// 1. CHARGEMENT PRIORITAIRE DES MODÈLES (Anti-500)
require('./models/Teacher');
require('./models/Player');
require('./models/Chapter');
require('./models/Homework');
require('./models/GameLevel');
require('./models/ScanSession');
require('./models/Submission');
require('./models/TeacherStyle');
require('./models/DeploySignal');

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connecté (Domaine Condamine)'))
    .catch(err => console.error("❌ DB Error:", err.message));

app.use(express.json({ limit: '50mb' }));

// 2. ROUTES API
app.use('/api/auth', require('./features/auth/auth.routes'));
app.use('/api/structure', require('./features/structure/structure.routes'));
app.use('/api/games', require('./features/games/games.routes'));
app.use('/api/homework', require('./features/homework/homework.routes'));
app.use('/api', require('./features/admin/admin.routes'));

app.get('/api/check-deploy', (req, res) => res.json({ bootId: SERVER_BOOT_ID }));
app.get('/api/deploy-status', (req, res) => res.json({ version: "2.1.3", build: 313, status: "live" }));

const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({error: "API non trouvée"});
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(port, () => console.log(`🚀 Serveur actif sur port ${port}`));