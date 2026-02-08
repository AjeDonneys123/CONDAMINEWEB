// @signatures: SERVER_BOOT_ID, GlobalInfrastructure, KernelV66_AUDIO_FIX
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
console.log("🚀 KERNEL V66 : RÉPARATION SON & ACTIONS");
console.log("------------------------------------------------");

app.use(express.json({ limit: '70mb' }));
app.use(express.urlencoded({ extended: true, limit: '70mb' }));

// 1. ROUTES SYSTÈME (Infaillibles)
app.get('/api/check-deploy', (req, res) => res.json({ status: "OK", bootId: SERVER_BOOT_ID }));
app.get('/api/system/apply-status', (req, res) => {
    try {
        const statusPath = path.join(__dirname, '../apply_status.json');
        if (fs.existsSync(statusPath)) {
            const data = fs.readFileSync(statusPath, 'utf8');
            res.json(JSON.parse(data));
        } else { res.json({ status: "OK" }); }
    } catch (e) { res.json({ status: "OK" }); }
});

// 2. CHARGEMENT SILOS (Blindage Anti-500)
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
    
    console.log("✅ Tous les silos sont chargés.");
} catch (e) {
    console.error("💥 Erreur Critique Chargement Silos:", e.message);
}

// 3. PROXY AUDIO/IMAGE TRANSPARENT (RÉPARE LE SILENCE)
const ProfDrive = require('./prof/core/drive.prof');
app.get(['/api/proxy/:id', '/api/structure/proxy/:id'], async (req, res) => {
    try {
        const fileId = req.params.id;
        if (!fileId || fileId === 'undefined') return res.status(400).send("ID manquant");
        
        const stream = await ProfDrive.getFileStream(fileId);
        
        // RÈGLE D'OR : On ne force plus le Content-Type.
        // On laisse le navigateur détecter s'il s'agit d'un MP3 ou d'un PNG.
        res.setHeader('Accept-Ranges', 'bytes');
        stream.pipe(res);
    } catch (e) { 
        console.error("❌ Proxy error:", e.message);
        res.status(404).send("File not found"); 
    }
});

// GESTIONNAIRE D'ERREUR GLOBAL (Anti-500 muet)
app.use((err, req, res, next) => {
    console.error("🔥 SERVER CRASH:", err.stack);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: err.message });
});

mongoose.connect(process.env.MONGODB_URI).then(() => {
    app.listen(port, '0.0.0.0', () => console.log(`🏁 READY SUR LE PORT ${port}`));
});
