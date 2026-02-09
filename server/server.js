// @signatures: SERVER_BOOT_ID, GlobalInfrastructure, KernelV85_RAW
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

// ROUTE STATUS DÉPLACÉE AU DESSUS DE TOUT
app.get('/api/system/apply-status', (req, res) => {
    res.json({ status: "OK", message: "Kernel V85 RAW Online" });
});

// PROXY ULTRA-BASIQUE (ZÉRO TRAITEMENT)
const ProfDrive = require('./prof/core/drive.prof');
app.get(['/api/proxy/:id', '/api/structure/proxy/:id'], async (req, res) => {
    try {
        const stream = await ProfDrive.getFileStream(req.params.id);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Accept-Ranges', 'bytes');
        stream.pipe(res);
    } catch (e) { res.status(404).send("Error"); }
});

const safeLoad = (r, p) => { try { app.use(r, require(p)); } catch (e) {} };
require('./prof/models/prof.models');
safeLoad('/api/auth', './prof/auth/auth.prof');
safeLoad('/api/admin', './prof/admin/admin.prof');
safeLoad('/api/homework', './prof/homework/homework.prof');
safeLoad('/api/games', './prof/games/games.prof');
safeLoad('/api/classroom', './prof/classroom/classroom.prof');
safeLoad('/api/scans', './prof/scans/scans.prof');
safeLoad('/api/structure', './prof/structure/structure.prof');
safeLoad('/api/studio', './prof/studio/studio.prof');

mongoose.connect(process.env.MONGODB_URI).then(() => {
    app.listen(port, '0.0.0.0', () => console.log(`🏁 KERNEL V85 READY`));
});
