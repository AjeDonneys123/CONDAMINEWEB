// @signatures: SERVER_BOOT_ID, GlobalInfrastructure, KernelV77_ULTRA_STABLE
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();
const app = express();
const port = 3000;
const SERVER_BOOT_ID = Date.now();

console.log("------------------------------------------------");
console.log("🚀 KERNEL V77 : RÉSILIENCE TOTALE");
console.log("------------------------------------------------");

app.use(express.json({ limit: '70mb' }));
app.use(express.urlencoded({ extended: true, limit: '70mb' }));

// 1. PRIORITÉ ABSOLUE : ROUTES SYSTÈME
app.get('/api/check-deploy', (req, res) => res.json({ status: "OK", bootId: SERVER_BOOT_ID }));

app.get('/api/system/apply-status', (req, res) => {
    try {
        const statusPath = path.join(__dirname, '../apply_status.json');
        if (fs.existsSync(statusPath)) {
            const raw = fs.readFileSync(statusPath, 'utf8');
            if (raw.trim()) return res.json(JSON.parse(raw));
        }
    } catch (e) {}
    res.json({ status: "OK", message: "En ligne" });
});

// 2. PROXY BINAIRE (SANS TRANSFORMATION)
const ProfDrive = require('./prof/core/drive.prof');
app.get(['/api/proxy/:id', '/api/structure/proxy/:id'], async (req, res) => {
    try {
        const fileId = req.params.id;
        if (!fileId || fileId === 'undefined') return res.status(400).send("No ID");
        const stream = await ProfDrive.getFileStream(fileId);
        res.setHeader('Accept-Ranges', 'bytes');
        stream.pipe(res);
    } catch (e) { res.status(404).send("File missing"); }
});

// 3. CHARGEMENT SÉCURISÉ DES SILOS (TRY/CATCH PAR SILO)
const safeLoad = (route, path) => {
    try { app.use(route, require(path)); } 
    catch (e) { console.error(`❌ Erreur chargement silo ${route}:`, e.message); }
};

safeLoad('/api/auth', './prof/auth/auth.prof');
safeLoad('/api/admin', './prof/admin/admin.prof');
safeLoad('/api/homework', './prof/homework/homework.prof');
safeLoad('/api/games', './prof/games/games.prof');
safeLoad('/api/classroom', './prof/classroom/classroom.prof');
safeLoad('/api/scans', './prof/scans/scans.prof');
safeLoad('/api/structure', './prof/structure/structure.prof');
safeLoad('/api/studio', './prof/studio/studio.prof');

// Silos élèves
safeLoad('/api/eleve/auth', './eleve/auth/auth.eleve');
safeLoad('/api/eleve/homework', './eleve/homework/homework.eleve');
safeLoad('/api/eleve/classroom', './eleve/classroom/classroom.eleve');
safeLoad('/api/eleve/games', './eleve/games/games.eleve');

// 4. GESTION DES ERREURS 500
app.use((err, req, res, next) => {
    console.error("🔥 CRASH SERVEUR:", err.stack);
    res.status(500).json({ status: "ERROR", message: err.message });
});

mongoose.connect(process.env.MONGODB_URI).then(() => {
    app.listen(port, '0.0.0.0', () => console.log(`🏁 READY SUR LE PORT ${port}`));
});
