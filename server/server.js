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
const models = ['AcademicYear', 'Admin', 'Classroom', 'Subject', 'Teacher', 'Student', 'Enrollment', 'Chapter', 'Homework', 'Submission', 'GameLevel', 'GameProgress', 'MistakesBook', 'AccessLog', 'BugReport', 'ProjectDoc', 'Player', 'StudioProject'];
models.forEach(m => { try { require(`./models/${m}`); } catch (e) { console.error(`Err Model ${m}:`, e.message); } });

app.use(express.json({ limit: '100mb' }));

// SERVEUR STATIQUE (Pour servir les images uploadées)
const uploadsPath = path.resolve(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
app.use('/uploads', express.static(uploadsPath));

// ROUTES API
app.use('/api/auth', require('./domains/auth/auth.routes'));
app.use('/api/admin', require('./domains/admin/admin.routes'));
app.use('/api/structure', require('./domains/structure/structure.routes'));
app.use('/api/games', require('./domains/games/games.routes'));
app.use('/api/homework', require('./domains/homework/homework.routes')); 
// C'EST ICI QUE CA SE JOUE :
app.use('/api/studio', require('./domains/studio/studio.routes'));

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
        if (req.url.startsWith('/uploads')) return res.status(404).send('Not found');
        res.sendFile(path.join(distPath, 'index.html'));
    });
}
app.listen(port, '0.0.0.0', () => console.log(`🚀 SERVEUR V104 UP | PORT ${port}`));