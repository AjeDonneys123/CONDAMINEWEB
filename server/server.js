// @signatures: SERVER_BOOT_ID, GlobalInfrastructure, KernelV83_STABLE
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
console.log("🚀 KERNEL V83 : CRITICAL ROUTE & AUDIO REPAIR");
console.log("------------------------------------------------");

app.use(express.json({ limit: '70mb' }));
app.use(express.urlencoded({ extended: true, limit: '70mb' }));

// --- 1. ROUTES SYSTÈME : PLACÉES AU SOMMET ABSOLU (ANTI-404) ---
app.get('/api/check-deploy', (req, res) => res.json({ status: "OK", bootId: SERVER_BOOT_ID }));

app.get('/api/system/apply-status', (req, res) => {
    try {
        // Résolution de chemin ultra-robuste
        const statusPath = path.resolve(process.cwd(), 'apply_status.json');
        if (fs.existsSync(statusPath)) {
            const raw = fs.readFileSync(statusPath, 'utf8');
            if (raw.trim()) return res.json(JSON.parse(raw));
        }
    } catch (e) {
        console.error("💥 apply-status error:", e.message);
    }
    res.json({ status: "OK", message: "Kernel V83 Online" });
});

// --- 2. PROXY MULTIMÉDIA : BINAIRE PUR POUR WEB AUDIO ---
const ProfDrive = require('./prof/core/drive.prof');
app.get(['/api/proxy/:id', '/api/structure/proxy/:id'], async (req, res) => {
    try {
        const fileId = req.params.id;
        if (!fileId || fileId === 'undefined' || fileId === 'null') {
            return res.status(400).send("ID Manquant");
        }
        
        const stream = await ProfDrive.getFileStream(fileId);
        
        // Headers vitaux pour que le navigateur accepte de décoder le son
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Accept-Ranges', 'bytes');
        // On ne définit PAS de Content-Type ici pour laisser le navigateur "sniffer" le type (Image vs Audio)
        
        stream.on('error', (err) => {
            console.error("❌ Stream error:", err.message);
            if (!res.headersSent) res.status(404).send("File lost on Drive");
        });

        stream.pipe(res);
    } catch (e) {
        console.error("❌ Proxy failure:", e.message);
        if (!res.headersSent) res.status(500).send("Drive Access Error");
    }
});

// --- 3. CHARGEMENT DES SILOS ---
const safeLoad = (route, filePath) => {
    try {
        const router = require(filePath);
        app.use(route, router);
        console.log(`✅ Silo : ${route}`);
    } catch (e) {
        console.error(`❌ Crash chargement ${route} :`, e.message);
    }
};

// Modèles d'abord
require('./prof/models/prof.models');

safeLoad('/api/auth', './prof/auth/auth.prof');
safeLoad('/api/admin', './prof/admin/admin.prof');
safeLoad('/api/homework', './prof/homework/homework.prof');
safeLoad('/api/games', './prof/games/games.prof');
safeLoad('/api/classroom', './prof/classroom/classroom.prof');
safeLoad('/api/scans', './prof/scans/scans.prof');
safeLoad('/api/structure', './prof/structure/structure.prof');
safeLoad('/api/studio', './prof/studio/studio.prof');

// Silos élève
safeLoad('/api/eleve/auth', './eleve/auth/auth.eleve');
safeLoad('/api/eleve/homework', './eleve/homework/homework.eleve');
safeLoad('/api/eleve/classroom', './eleve/classroom/classroom.eleve');
safeLoad('/api/eleve/games', './eleve/games/games.eleve');

app.use((err, req, res, next) => {
    console.error("🚨 INTERNAL ERROR:", err.stack);
    res.status(500).json({ error: "SERVER_CRASH", message: err.message });
});

mongoose.connect(process.env.MONGODB_URI).then(() => {
    app.listen(port, '0.0.0.0', () => console.log(`🏁 KERNEL READY ON ${port}`));
});
