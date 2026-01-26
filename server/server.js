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

// --- CONFIGURATION DES CHEMINS ---
const publicPath = path.resolve(process.cwd(), 'public');
const uploadsPath = path.join(publicPath, 'uploads');

// Création des dossiers si inexistants
if (!fs.existsSync(publicPath)) fs.mkdirSync(publicPath, { recursive: true });
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });

// 1. SERVICE STATIQUE NATIF (Plus rapide & Fiable)
// Express sert directement les fichiers s'ils existent exactement à cet endroit
app.use('/uploads', express.static(uploadsPath));

// 2. SERVEUR D'IMAGES INTELLIGENT (FALLBACK / DÉTECTIVE)
// Si le statique n'a rien trouvé (404), on essaie de "deviner" le fichier
app.get('/uploads/:filename', (req, res) => {
    const requestedFile = req.params.filename;
    // Décodage pour gérer les espaces et caractères spéciaux
    const cleanName = decodeURIComponent(requestedFile).split('?')[0]; 
    const filePath = path.join(uploadsPath, cleanName);

    // A. Recherche Exacte (si static a raté pour une raison obscure)
    if (fs.existsSync(filePath)) return res.sendFile(filePath);

    // B. Recherche avec extensions alternatives
    const extensions = ['.jpg', '.jpeg', '.png', '.webp', '.blob'];
    for (const ext of extensions) {
        if (fs.existsSync(filePath + ext)) {
            return res.sendFile(filePath + ext);
        }
    }

    // C. Recherche approximative (Si le nom a été tronqué ou préfixe seul)
    try {
        const dirFiles = fs.readdirSync(uploadsPath);
        // On suppose que le fichier commence par "scan-" ou "hw-" ou "studio-"
        const prefix = cleanName.split('.')[0]; 
        const match = dirFiles.find(f => f.startsWith(prefix));
        if (match) {
            return res.sendFile(path.join(uploadsPath, match));
        }
    } catch(e) {}

    // ÉCHEC TOTAL
    console.error(`❌ [IMG-404] Introuvable: ${cleanName} dans ${uploadsPath}`);
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
        // On ne redirige PAS les appels /uploads vers index.html (Double sécurité)
        if (req.url.startsWith('/uploads/')) return res.status(404).send("Not found");
        res.sendFile(path.join(distPath, 'index.html'));
    });
}
app.listen(port, '0.0.0.0', () => console.log(`🚀 SERVEUR V109 (STATIC FIRST) UP | PORT ${port}`));