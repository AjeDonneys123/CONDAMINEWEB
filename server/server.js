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
const SERVER_BOOT_ID = Date.now();

// CHARGEMENT MODÈLES
const models = ['AcademicYear', 'Admin', 'Classroom', 'Subject', 'Teacher', 'Student', 'Enrollment', 'Chapter', 'Homework', 'Submission', 'GameLevel', 'GameProgress', 'MistakesBook', 'AccessLog', 'BugReport', 'ProjectDoc', 'Player', 'StudioProject', 'Sanction', 'ScanSession'];
models.forEach(m => { try { require(`./models/${m}`); } catch (e) { console.error(`Err Model ${m}:`, e.message); } });

app.use(express.json({ limit: '100mb' }));

// --- SERVEUR D'IMAGES INTELLIGENT V2 (DÉTECTIVE) ---
const uploadsPath = path.resolve(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });

app.get('/uploads/:filename', (req, res) => {
    const requestedFile = req.params.filename;
    const cleanName = requestedFile.split('?')[0]; // Enlève les paramètres d'URL éventuels
    const filePath = path.join(uploadsPath, cleanName);

    // 1. Recherche Exacte
    if (fs.existsSync(filePath)) return res.sendFile(filePath);

    // 2. Recherche avec extensions (si l'URL n'en a pas ou si c'est la mauvaise)
    const extensions = ['.jpg', '.jpeg', '.png', '.webp', '.blob'];
    for (const ext of extensions) {
        if (fs.existsSync(filePath + ext)) {
            // console.log(`🔍 [SMART-IMG] Retrouvé avec extension : ${cleanName}${ext}`);
            return res.sendFile(filePath + ext);
        }
    }

    // 3. Recherche approximative (Si le nom a été tronqué)
    // On cherche un fichier qui commence par le même ID (ex: "scan-12345...")
    try {
        const dirFiles = fs.readdirSync(uploadsPath);
        // On suppose que le fichier commence par "scan-" ou "hw-" ou "studio-"
        const prefix = cleanName.split('.')[0]; 
        const match = dirFiles.find(f => f.startsWith(prefix));
        if (match) {
            // console.log(`🔍 [SMART-IMG] Correspondance approximative : ${match}`);
            return res.sendFile(path.join(uploadsPath, match));
        }
    } catch(e) {}

    // ÉCHEC
    console.error(`❌ [IMG-404] Introuvable sur le disque : ${cleanName}`);
    res.status(404).send('Fichier introuvable');
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

app.get('/api/check-deploy', (req, res) => res.json({ bootId: SERVER_BOOT_ID, status: "OK" }));

app.use((err, req, res, next) => {
    console.error("🔥 [SERVER_ERROR]:", err.message);
    res.status(500).json({ error: err.message || "Erreur serveur" });
});

mongoose.connect(process.env.MONGODB_URI).then(() => console.log('✅ BDD CONNECTÉE & MODÈLES PRÊTS'));

const distPath = path.resolve(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.url.startsWith('/uploads/')) return next();
        res.sendFile(path.join(distPath, 'index.html'));
    });
}
app.listen(port, '0.0.0.0', () => console.log(`🚀 SERVEUR V108 (FILE DETECTIVE) UP | PORT ${port}`));