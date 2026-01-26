const path = require('path');
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// POLYFILLS
if (!global.fetch) {
    const fetch = require('node-fetch');
    global.fetch = fetch;
    global.Headers = fetch.Headers;
    global.Request = fetch.Request;
    global.Response = fetch.Response;
}

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
const SERVER_BOOT_ID = Date.now(); // ID unique du démarrage

// CHARGEMENT MODÈLES
const models = ['AcademicYear', 'Admin', 'Classroom', 'Subject', 'Teacher', 'Student', 'Enrollment', 'Chapter', 'Homework', 'Submission', 'GameLevel', 'GameProgress', 'MistakesBook', 'AccessLog', 'BugReport', 'ProjectDoc', 'Player', 'StudioProject', 'Sanction', 'ScanSession'];
models.forEach(m => { try { require(`./models/${m}`); } catch (e) { console.error(`Err Model ${m}:`, e.message); } });

app.use(express.json({ limit: '100mb' }));

// --- CONFIGURATION DES CHEMINS ---
const publicPath = path.resolve(process.cwd(), 'public');
const uploadsPath = path.join(publicPath, 'uploads');

if (!fs.existsSync(publicPath)) fs.mkdirSync(publicPath, { recursive: true });
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });

// 1. SERVICE STATIQUE
app.use('/uploads', express.static(uploadsPath));

// 2. FALLBACK DÉTECTIVE
app.get('/uploads/:filename', (req, res) => {
    const requestedFile = req.params.filename;
    const cleanName = decodeURIComponent(requestedFile).split('?')[0]; 
    const filePath = path.join(uploadsPath, cleanName);

    if (fs.existsSync(filePath)) return res.sendFile(filePath);

    // Recherche extensions
    const extensions = ['.jpg', '.jpeg', '.png', '.webp', '.blob'];
    for (const ext of extensions) {
        if (fs.existsSync(filePath + ext)) return res.sendFile(filePath + ext);
    }

    console.error(`❌ [IMG-404] Fichier physiquement absent : ${cleanName}`);
    res.status(404).send('Fichier introuvable sur le disque serveur.');
});

// ROUTES API
app.use('/api/auth', require('./domains/auth/auth.routes'));
app.use('/api/admin', require('./domains/admin/admin.routes'));
app.use('/api/structure', require('./domains/structure/structure.routes'));
app.use('/api/games', require('./domains/games/games.routes'));
app.use('/api/homework', require('./domains/homework/homework.routes')); 
app.use('/api/studio', require('./domains/studio/studio.routes'));
app.use('/api/classroom', require('./domains/classroom/classroom.routes'));
app.use('/api/scans', require('./domains/scans/scans.routes'));

// --- ROUTE DE VÉRIFICATION DE VERSION ---
app.get('/api/check-deploy', (req, res) => {
    res.json({ 
        status: "OK", 
        version: "V112_NUCLEAR_DEBUG", 
        bootId: SERVER_BOOT_ID,
        message: "Si tu vois ça, le nouveau code est actif." 
    });
});

app.use((err, req, res, next) => {
    console.error("🔥 [SERVER_ERROR]:", err.message);
    res.status(500).json({ error: err.message || "Erreur serveur" });
});

mongoose.connect(process.env.MONGODB_URI).then(() => console.log('✅ BDD CONNECTÉE & MODÈLES PRÊTS'));

const distPath = path.resolve(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.url.startsWith('/uploads/')) return res.status(404).send("Not found");
        res.sendFile(path.join(distPath, 'index.html'));
    });
}
app.listen(port, '0.0.0.0', () => console.log(`🚀 SERVEUR V112 (NUCLEAR) UP | PORT ${port}`));