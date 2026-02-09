// @signatures: SERVER_BOOT_ID, GlobalInfrastructure, KernelV76_STABLE
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
console.log("🚀 KERNEL V76 : RÉPARATION SON & SYSTÈME");
console.log("------------------------------------------------");

app.use(express.json({ limit: '70mb' }));
app.use(express.urlencoded({ extended: true, limit: '70mb' }));

// 1. ROUTES SYSTÈME (FIX 404) - PLACÉES AVANT TOUT
app.get('/api/check-deploy', (req, res) => res.json({ status: "OK", bootId: SERVER_BOOT_ID }));

app.get('/api/system/apply-status', (req, res) => {
    try {
        const statusPath = path.join(__dirname, '../apply_status.json');
        if (fs.existsSync(statusPath)) {
            const data = fs.readFileSync(statusPath, 'utf8');
            return res.json(JSON.parse(data));
        }
    } catch (e) { console.error("Apply status read error", e); }
    res.json({ status: "OK", message: "Serveur en ligne" });
});

// 2. PROXY AUDIO/IMAGE TRANSPARENT (FIX SILENCE)
const ProfDrive = require('./prof/core/drive.prof');
app.get(['/api/proxy/:id', '/api/structure/proxy/:id'], async (req, res) => {
    try {
        const fileId = req.params.id;
        if (!fileId || fileId === 'undefined') return res.status(400).send("No ID");
        const stream = await ProfDrive.getFileStream(fileId);
        res.setHeader('Accept-Ranges', 'bytes');
        stream.pipe(res);
    } catch (e) { res.status(404).send("File not found"); }
});

// 3. CHARGEMENT DES SILOS (FIX 500)
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
} catch (e) { 
    console.error("💥 Erreur critique chargement silos:", e.message); 
}

app.use((err, req, res, next) => {
    console.error("❌ Erreur Serveur:", err.stack);
    res.status(500).json({ status: "ERROR", message: err.message });
});

mongoose.connect(process.env.MONGODB_URI).then(() => {
    app.listen(port, '0.0.0.0', () => console.log(`🏁 PRET SUR LE PORT ${port}`));
});
