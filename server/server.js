// @signatures: SERVER_BOOT_ID, GlobalInfrastructure, KernelV59_CLEAN
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
console.log("🚀 KERNEL V59 : RETOUR À LA STABILITÉ");
console.log("------------------------------------------------");

app.use(express.json({ limit: '70mb' }));
app.use(express.urlencoded({ extended: true, limit: '70mb' }));

// 1. ROUTES SYSTÈME (Infaillibles)
app.get('/api/check-deploy', (req, res) => res.json({ status: "OK", bootId: SERVER_BOOT_ID }));
app.get('/api/system/version', (req, res) => res.json({ hash: "V59-STABLE", build: 172 }));
app.get('/api/system/apply-status', (req, res) => res.json({ status: "OK" }));

// 2. CHARGEMENT SÉCURISÉ
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

    // Silos Elève
    app.use('/api/eleve/auth', require('./eleve/auth/auth.eleve'));
    app.use('/api/eleve/homework', require('./eleve/homework/homework.eleve'));
    app.use('/api/eleve/classroom', require('./eleve/classroom/classroom.eleve'));
    app.use('/api/eleve/games', require('./eleve/games/games.eleve'));
    
    console.log("✅ Tous les silos sont chargés.");
} catch (e) {
    console.error("💥 Erreur critique Boot:", e.message);
}

// 3. PROXY IMAGES
const ProfDrive = require('./prof/core/drive.prof');
app.get(['/api/proxy/:id', '/api/structure/proxy/:id'], async (req, res) => {
    try {
        const stream = await ProfDrive.getFileStream(req.params.id);
        res.setHeader('Content-Type', 'image/png');
        stream.pipe(res);
    } catch (e) { res.status(404).send("Error"); }
});

// 4. ORACLE
app.use((err, req, res, next) => {
    res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
});

mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log("📂 MongoDB Connecté.");
    app.listen(port, '0.0.0.0', () => console.log(`🏁 PRET SUR LE PORT ${port}`));
});
