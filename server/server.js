// @signatures: SERVER_BOOT_ID, GlobalInfrastructure, KernelV56_CLEAN
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

console.log("------------------------------------------------");
console.log("🚀 DÉMARRAGE DU SERVEUR (MODE PROD V56)");
console.log("------------------------------------------------");

dotenv.config();
const app = express();
const port = 3000;
const SERVER_BOOT_ID = Date.now();

mongoose.set('strictQuery', false);

app.use(express.json({ limit: '70mb' }));
app.use(express.urlencoded({ extended: true, limit: '70mb' }));

// 1. LOGGER CIBLÉ (Uniquement les erreurs et les actions critiques)
app.use((req, res, next) => {
    if (req.method !== 'GET' && !req.url.includes('check-deploy') && !req.url.includes('apply-status')) {
        console.log(`📥 REQ: ${req.method} ${req.url}`);
    }
    next();
});

// 2. ROUTES SYSTÈME
app.get('/api/check-deploy', (req, res) => res.json({ status: "OK", bootId: SERVER_BOOT_ID }));
app.get('/api/system/version', (req, res) => res.json({ hash: "V56-PROD", build: 164 }));
app.get('/api/system/apply-status', (req, res) => {
    try {
        const p = path.join(__dirname, '../apply_status.json');
        if (fs.existsSync(p)) res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
        else res.json({ status: "OK" });
    } catch (e) { res.json({ status: "OK" }); }
});

const ProfDrive = require('./prof/core/drive.prof');
app.get(['/api/proxy/:id', '/api/structure/proxy/:id'], async (req, res) => {
    try {
        const stream = await ProfDrive.getFileStream(req.params.id);
        res.setHeader('Content-Type', 'image/png');
        stream.pipe(res);
    } catch (e) { res.status(404).send("Cloud error"); }
});

// 3. CHARGEMENT
const loadRoute = (pathRel, routeName) => {
    try {
        const r = require(pathRel);
        app.use(`/api/${routeName}`, r);
    } catch (e) { console.error(`❌ ECHEC ${routeName}:`, e.message); }
};

try {
    require('./prof/models/prof.models');
    loadRoute('./prof/auth/auth.prof', 'auth');
    loadRoute('./prof/admin/admin.prof', 'admin');
    loadRoute('./prof/homework/homework.prof', 'homework');
    loadRoute('./prof/games/games.prof', 'games');
    loadRoute('./prof/classroom/classroom.prof', 'classroom');
    loadRoute('./prof/scans/scans.prof', 'scans');
    loadRoute('./prof/structure/structure.prof', 'structure');
    loadRoute('./prof/studio/studio.prof', 'studio');
    loadRoute('./eleve/auth/auth.eleve', 'eleve/auth');
    loadRoute('./eleve/homework/homework.eleve', 'eleve/homework');
    loadRoute('./eleve/classroom/classroom.eleve', 'eleve/classroom');
    loadRoute('./eleve/games/games.eleve', 'eleve/games');
} catch (globalErr) { console.error("💥 CRASH CHARGEMENT:", globalErr); }

app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// 4. ORACLE
app.use((err, req, res, next) => {
    console.error("🔥 ERREUR 500:", err.message);
    res.status(500).json({ error: "CRASH SERVEUR", message: err.message });
});

const initServices = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("📂 MongoDB Connecté.");
        app.listen(port, '0.0.0.0', () => console.log(`🏁 PRET SUR LE PORT ${port}`));
    } catch (err) { console.error("❌ ECHEC DB:", err.message); }
};

initServices();
