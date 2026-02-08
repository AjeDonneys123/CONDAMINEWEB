// @signatures: SERVER_BOOT_ID, GlobalInfrastructure, KernelV63_RAW_PROXY
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
console.log("🚀 KERNEL V63 : FIX AUDIO PROXY");
console.log("------------------------------------------------");

app.use(express.json({ limit: '70mb' }));
app.use(express.urlencoded({ extended: true, limit: '70mb' }));

app.get('/api/check-deploy', (req, res) => res.json({ status: "OK", bootId: SERVER_BOOT_ID }));
app.get('/api/system/apply-status', (req, res) => {
    try {
        const statusPath = path.join(__dirname, '../apply_status.json');
        if (fs.existsSync(statusPath)) res.json(JSON.parse(fs.readFileSync(statusPath, 'utf8')));
        else res.json({ status: "OK" });
    } catch (e) { res.json({ status: "OK" }); }
});

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
} catch (e) { console.error("💥 Boot Error:", e.message); }

const ProfDrive = require('./prof/core/drive.prof');
app.get(['/api/proxy/:id', '/api/structure/proxy/:id'], async (req, res) => {
    try {
        const fileId = req.params.id;
        const stream = await ProfDrive.getFileStream(fileId);
        // FIX : On ne force plus "image/png" pour permettre le décodage MP3/WAV par la Web Audio API
        res.setHeader('Accept-Ranges', 'bytes');
        stream.pipe(res);
    } catch (e) { res.status(404).send("File not found"); }
});

app.use((err, req, res, next) => { res.status(500).json({ error: "INTERNAL_ERROR", message: err.message }); });

mongoose.connect(process.env.MONGODB_URI).then(() => {
    app.listen(port, '0.0.0.0', () => console.log(`🏁 PRET SUR LE PORT ${port}`));
});
