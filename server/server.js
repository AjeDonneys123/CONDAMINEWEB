// @signatures: SERVER_BOOT_ID, GlobalInfrastructure, KernelV68_STABLE_FIX
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
console.log("🚀 KERNEL V68 : RÉPARATION CRITIQUE DES ROUTES");
console.log("------------------------------------------------");

app.use(express.json({ limit: '70mb' }));
app.use(express.urlencoded({ extended: true, limit: '70mb' }));

// 1. ROUTES SYSTÈME PRIORITAIRES (Évite les 404)
app.get('/api/check-deploy', (req, res) => res.json({ status: "OK", bootId: SERVER_BOOT_ID }));

app.get('/api/system/apply-status', (req, res) => {
    try {
        const statusPath = path.join(__dirname, '../apply_status.json');
        if (fs.existsSync(statusPath)) {
            const data = fs.readFileSync(statusPath, 'utf8');
            return res.json(JSON.parse(data));
        }
    } catch (e) {}
    res.json({ status: "OK", message: "En attente..." });
});

// 2. CHARGEMENT DES SILOS (Avec sécurité 500)
try {
    const Models = require('./prof/models/prof.models');
    
    // On vérifie que la connexion DB est OK avant de brancher les routes
    app.use((req, res, next) => {
        if (mongoose.connection.readyState !== 1 && !req.path.includes('apply-status')) {
            return res.status(500).json({ error: "DATABASE_OFFLINE" });
        }
        next();
    });

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
    
    console.log("✅ Silos chargés.");
} catch (e) {
    console.error("💥 ERREUR BOOT SILOS:", e.message);
}

// 3. PROXY AUDIO/IMAGE (RAW BYTES)
const ProfDrive = require('./prof/core/drive.prof');
app.get(['/api/proxy/:id', '/api/structure/proxy/:id'], async (req, res) => {
    try {
        const fileId = req.params.id;
        if (!fileId || fileId === 'undefined' || fileId === 'null') return res.status(400).send("Bad ID");
        const stream = await ProfDrive.getFileStream(fileId);
        res.setHeader('Accept-Ranges', 'bytes');
        // Pas de Content-Type forcé pour laisser le décodeur audio travailler
        stream.pipe(res);
    } catch (e) { res.status(404).send("File not found"); }
});

// GESTIONNAIRE D'ERREUR FINAL (Empêche le 500 vide)
app.use((err, req, res, next) => {
    console.error("🔥 Server Error:", err.stack);
    res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
});

mongoose.connect(process.env.MONGODB_URI).then(() => {
    app.listen(port, '0.0.0.0', () => console.log(`🏁 PRET SUR LE PORT ${port}`));
});
