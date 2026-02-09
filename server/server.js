// @signatures: SERVER_BOOT_ID, GlobalInfrastructure, KernelV80_STABLE
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
console.log("🚀 KERNEL V80 : EMERGENCY STABILIZATION");
console.log("------------------------------------------------");

app.use(express.json({ limit: '70mb' }));
app.use(express.urlencoded({ extended: true, limit: '70mb' }));

// 1. ROUTES SYSTÈME PRIORITAIRES
app.get('/api/check-deploy', (req, res) => res.json({ status: "OK", bootId: SERVER_BOOT_ID }));

app.get('/api/system/apply-status', (req, res) => {
    try {
        const statusPath = path.join(__dirname, '../apply_status.json');
        if (fs.existsSync(statusPath)) {
            const raw = fs.readFileSync(statusPath, 'utf8');
            if (raw.trim()) return res.json(JSON.parse(raw));
        }
    } catch (e) {
        console.error("Error reading apply-status:", e.message);
    }
    res.json({ status: "OK", message: "Kernel V80 Online" });
});

// 2. PROXY MULTIMÉDIA (FIX DÉCODAGE AUDIO)
const ProfDrive = require('./prof/core/drive.prof');
app.get(['/api/proxy/:id', '/api/structure/proxy/:id'], async (req, res) => {
    try {
        const fileId = req.params.id;
        if (!fileId || fileId === 'undefined' || fileId === 'null') {
            return res.status(400).send("Invalid ID");
        }
        
        const stream = await ProfDrive.getFileStream(fileId);
        
        // Headers essentiels pour le décodage Web Audio et les images
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Access-Control-Allow-Origin', '*');
        // On laisse le stream définir son propre Content-Type ou on reste générique
        stream.on('error', (err) => {
            console.error("Proxy Stream Error:", err.message);
            if (!res.headersSent) res.status(404).send("Not Found");
        });
        
        stream.pipe(res);
    } catch (e) {
        console.error("Proxy Fatal Error:", e.message);
        if (!res.headersSent) res.status(500).send("Drive Link Broken");
    }
});

// 3. CHARGEMENT SÉQUENTIEL DES SILOS
const safeLoad = (route, filePath) => {
    try {
        const router = require(filePath);
        app.use(route, router);
        console.log(`✅ Silo chargé : ${route}`);
    } catch (e) {
        console.error(`❌ ÉCHEC Chargement silo ${route} :`, e.message);
    }
};

// Initialisation des modèles avant les routes
require('./prof/models/prof.models');

safeLoad('/api/auth', './prof/auth/auth.prof');
safeLoad('/api/admin', './prof/admin/admin.prof');
safeLoad('/api/homework', './prof/homework/homework.prof');
safeLoad('/api/games', './prof/games/games.prof');
safeLoad('/api/classroom', './prof/classroom/classroom.prof');
safeLoad('/api/scans', './prof/scans/scans.prof');
safeLoad('/api/structure', './prof/structure/structure.prof');
safeLoad('/api/studio', './prof/studio/studio.prof');

// Silos Elève
safeLoad('/api/eleve/auth', './eleve/auth/auth.eleve');
safeLoad('/api/eleve/homework', './eleve/homework/homework.eleve');
safeLoad('/api/eleve/classroom', './eleve/classroom/classroom.eleve');
safeLoad('/api/eleve/games', './eleve/games/games.eleve');

// 4. GESTIONNAIRE D'ERREURS GLOBAL (Anti-500)
app.use((err, req, res, next) => {
    console.error("🚨 GLOBAL ERROR:", err.stack);
    res.status(500).json({ 
        error: "INTERNAL_SERVER_ERROR", 
        message: err.message,
        path: req.path
    });
});

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        app.listen(port, '0.0.0.0', () => {
            console.log(`🏁 SERVEUR PRÊT SUR LE PORT ${port}`);
        });
    })
    .catch(err => console.error("❌ MongoDB Connection Error:", err));
