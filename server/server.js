// @signatures: SERVER_BOOT_ID, GlobalInfrastructure, KernelV72_FINAL_REPAIR
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();
const app = express();
const port = 3000;
const SERVER_BOOT_ID = Date.now();

app.use(express.json({ limit: '70mb' }));
app.use(express.urlencoded({ extended: true, limit: '70mb' }));

// --- 🛡️ ZONE DE SÉCURITÉ : ROUTES SYSTÈME (FIX 404) ---
app.get('/api/check-deploy', (req, res) => res.json({ status: "OK", bootId: SERVER_BOOT_ID }));

app.get('/api/system/apply-status', (req, res) => {
    try {
        const statusPath = path.join(__dirname, '../apply_status.json');
        if (fs.existsSync(statusPath)) {
            const data = fs.readFileSync(statusPath, 'utf8');
            return res.json(JSON.parse(data));
        }
    } catch (e) {}
    res.json({ status: "OK", message: "Connecté" });
});

// PROXY AUDIO/IMAGE TRANSPARENT
const ProfDrive = require('./prof/core/drive.prof');
app.get(['/api/proxy/:id', '/api/structure/proxy/:id'], async (req, res) => {
    try {
        const fileId = req.params.id;
        if (!fileId || fileId === 'undefined') return res.status(400).send("No ID");
        const stream = await ProfDrive.getFileStream(fileId);
        res.setHeader('Accept-Ranges', 'bytes');
        stream.pipe(res);
    } catch (e) { res.status(404).send("Not found"); }
});

// CHARGEMENT DES SILOS
try {
    app.use('/api/auth', require('./prof/auth/auth.prof'));
    app.use('/api/admin', require('./prof/admin/admin.prof'));
    app.use('/api/homework', require('./prof/homework/homework.prof'));
    app.use('/api/games', require('./prof/games/games.prof'));
    app.use('/api/classroom', require('./prof/classroom/classroom.prof'));
    app.use('/api/scans', require('./prof/scans/scans.prof'));
    app.use('/api/structure', require('./prof/structure/structure.prof'));
    app.use('/api/studio', require('./prof/studio/studio.prof'));
} catch (e) { console.error("Silo error:", e.message); }

mongoose.connect(process.env.MONGODB_URI).then(() => {
    app.listen(port, '0.0.0.0', () => console.log(`🏁 KERNEL V72 READY`));
});
