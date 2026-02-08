// @signatures: SERVER_BOOT_ID, GlobalInfrastructure, KernelV64_ULTRA_STABLE
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
console.log("🚀 KERNEL V64 : RÉPARATION & DÉBOGAGE VISUEL");
console.log("------------------------------------------------");

app.use(express.json({ limit: '70mb' }));
app.use(express.urlencoded({ extended: true, limit: '70mb' }));

// 1. ROUTES SYSTÈME BLINDÉES (Anti-500)
app.get('/api/check-deploy', (req, res) => res.json({ status: "OK", bootId: SERVER_BOOT_ID }));

app.get('/api/system/apply-status', (req, res) => {
    try {
        const statusPath = path.join(__dirname, '../apply_status.json');
        if (fs.existsSync(statusPath)) {
            const raw = fs.readFileSync(statusPath, 'utf8');
            if (!raw || raw.trim() === "") return res.json({ status: "OK" });
            res.json(JSON.parse(raw));
        } else {
            res.json({ status: "OK", message: "Initialisation..." });
        }
    } catch (e) {
        res.json({ status: "OK", error: "Read fail" });
    }
});

// 2. CHARGEMENT SILOS AVEC CAPTURE D'ERREUR
try {
    const Models = require('./prof/models/prof.models');
    
    app.use('/api/auth', require('./prof/auth/auth.prof'));
    app.use('/api/admin', require('./prof/admin/admin.prof'));
    app.use('/api/homework', require('./prof/homework/homework.prof'));
    app.use('/api/games', require('./prof/games/games.prof'));
    app.use('/api/classroom', require('./prof/classroom/classroom.prof'));
    app.use('/api/scans', require('./prof/scans/scans.prof'));
    app.use('/api/structure', require('./prof/structure/structure.prof'));
    app.use('/api/studio', require('./prof/studio/studio.prof'));

    app.use('/api/eleve/auth', require('./eleve/auth/auth.eleve'));
    app.use('/api/eleve/homework', require('./eleve/homework/homework.eleve'));
    app.use('/api/eleve/classroom', require('./eleve/classroom/classroom.eleve'));
    app.use('/api/eleve/games', require('./eleve/games/games.eleve'));
    
    console.log("✅ Silos opérationnels.");
} catch (e) {
    console.error("💥 CRASH CHARGEMENT SILOS:", e.message);
}

// 3. PROXY AUDIO/IMAGE (FLUX BRUT)
const ProfDrive = require('./prof/core/drive.prof');
app.get(['/api/proxy/:id', '/api/structure/proxy/:id'], async (req, res) => {
    try {
        const fileId = req.params.id;
        if (!fileId || fileId === 'undefined' || fileId === 'null') return res.status(400).send("Invalid ID");
        
        const stream = await ProfDrive.getFileStream(fileId);
        res.setHeader('Accept-Ranges', 'bytes');
        // On laisse le navigateur décider du Content-Type pour supporter MP3 et Images
        stream.pipe(res);
    } catch (e) { 
        res.status(404).send("File not found"); 
    }
});

// GESTIONNAIRE D'ERREUR GLOBAL (Empêche le 500 vide)
app.use((err, req, res, next) => {
    console.error("🔥 SERVER ERROR:", err.stack);
    res.status(500).json({ 
        status: "ERROR", 
        message: err.message,
        path: req.path
    });
});

mongoose.connect(process.env.MONGODB_URI).then(() => {
    app.listen(port, '0.0.0.0', () => console.log(`🏁 READY ON PORT ${port}`));
});
