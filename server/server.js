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

// --- SERVEUR D'IMAGES INTELLIGENT (SMART STATIC) ---
const uploadsPath = path.resolve(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });

// Cette route intercepte toutes les demandes d'images
app.get('/uploads/:filename', (req, res) => {
    const requestedFile = req.params.filename;
    const filePath = path.join(uploadsPath, requestedFile);

    // 1. Cas idéal : Le fichier existe tel quel
    if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
    }

    // 2. Cas "Ancien Scan" : On essaie d'ajouter .jpg
    if (fs.existsSync(filePath + '.jpg')) {
        return res.sendFile(filePath + '.jpg');
    }

    // 3. Cas "Capture d'écran" : On essaie d'ajouter .png
    if (fs.existsSync(filePath + '.png')) {
        return res.sendFile(filePath + '.png');
    }

    // 4. Cas désespéré : On cherche un fichier qui commence par cet ID
    // (Utile si le nom a été tronqué ou modifié)
    try {
        const files = fs.readdirSync(uploadsPath);
        const match = files.find(f => f.startsWith(requestedFile));
        if (match) {
            return res.sendFile(path.join(uploadsPath, match));
        }
    } catch (e) {}

    // Si vraiment introuvable
    console.error(`❌ Image introuvable : ${requestedFile}`);
    res.status(404).send('Image non trouvée sur le serveur.');
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
        // On laisse passer les uploads vers notre gestionnaire intelligent
        if (req.url.startsWith('/uploads/')) return next();
        res.sendFile(path.join(distPath, 'index.html'));
    });
}
app.listen(port, '0.0.0.0', () => console.log(`🚀 SERVEUR V107 (SMART IMAGES) UP | PORT ${port}`));