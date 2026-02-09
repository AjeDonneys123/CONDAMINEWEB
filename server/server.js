// @signatures: SERVER_BOOT_ID, GlobalInfrastructure, KernelV87_RECOVERY
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
console.log("🚀 KERNEL V87 : RECOVERY MODE");
console.log("------------------------------------------------");

app.use(express.json({ limit: '70mb' }));
app.use(express.urlencoded({ extended: true, limit: '70mb' }));

// 1. CHARGEMENT MODÈLES CRITIQUE
try {
    console.log("📦 Chargement des Modèles...");
    require('./prof/models/prof.models');
    console.log("✅ Modèles chargés avec succès.");
} catch (e) {
    console.error("💥 ERREUR CRITIQUE MODÈLES :", e.message);
    console.error("   Le serveur va probablement échouer sur les requêtes BDD.");
}

// 2. ROUTES SYSTÈME (Toujours actives)
app.get('/api/check-deploy', (req, res) => res.json({ status: "OK", bootId: SERVER_BOOT_ID }));
app.get('/api/system/apply-status', (req, res) => res.json({ status: "OK", message: "Kernel V87 Online" }));

// 3. PROXY RAW (Audio/Image)
const ProfDrive = require('./prof/core/drive.prof');
app.get(['/api/proxy/:id', '/api/structure/proxy/:id'], async (req, res) => {
    try {
        const fileId = req.params.id;
        if (!fileId || fileId === 'undefined') return res.status(400).send("No ID");
        
        const stream = await ProfDrive.getFileStream(fileId);
        res.setHeader('Access-Control-Allow-Origin', '*');
        // Pas de Content-Type forcé pour laisser le navigateur détecter (MP3/WAV/PNG)
        res.setHeader('Accept-Ranges', 'bytes');
        stream.pipe(res);
    } catch (e) { res.status(404).send("Not found"); }
});

// 4. CHARGEMENT DES SILOS
const safeLoad = (route, path) => {
    try { 
        app.use(route, require(path)); 
        // console.log(`   Route ${route} OK`);
    } catch (e) { 
        console.error(`❌ Échec chargement ${route}:`, e.message); 
    }
};

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

// 5. DEMARRAGE MONGOOSE
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("📂 MongoDB Connecté.");
        app.listen(port, '0.0.0.0', () => console.log(`🏁 PRET SUR LE PORT ${port}`));
    })
    .catch(err => console.error("❌ Erreur Connexion MongoDB:", err));
