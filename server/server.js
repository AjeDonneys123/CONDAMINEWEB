const path = require('path');
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

if (!global.fetch) global.fetch = require('node-fetch');
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const SERVER_BOOT_ID = Date.now();

console.log("------------------------------------------------");
console.log("🚀 [SYSTEM] Initialisation Condamine ARCHITECTE PRO");
console.log("------------------------------------------------");

// ENREGISTREMENT DES 17 MODÈLES DANS L'ORDRE
const models = [
    'AcademicYear', 'Admin', 'Classroom', 'Subject', 'Teacher', 'Student', 
    'Enrollment', 'Chapter', 'Homework', 'Submission', 'GameLevel', 
    'GameProgress', 'MistakesBook', 'AccessLog', 'BugReport', 'ProjectDoc', 'Player'
];

models.forEach(m => {
    try {
        require(`./models/${m}`);
    } catch (e) { console.error(`❌ Erreur modèle ${m}:`, e.message); }
});

app.use(express.json({ limit: '100mb' }));

// ROUTES DOMAINES
app.use('/api/auth', require('./domains/auth/auth.routes'));
app.use('/api/admin', require('./domains/admin/admin.routes'));
app.use('/api/structure', require('./domains/structure/structure.routes'));
app.use('/api/games', require('./domains/games/games.routes'));
app.use('/api/homework', require('./domains/homework/homework.routes')); 

app.get('/api/check-deploy', (req, res) => res.json({ bootId: SERVER_BOOT_ID, status: "OK" }));

mongoose.connect(process.env.MONGODB_URI).then(() => console.log('✅ BDD CONNECTÉE & MODÈLES PRÊTS'));

const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
} else {
    app.get('/', (req, res) => res.send("<h1>Condamine Backend Pro Ready</h1>"));
}

app.listen(port, '0.0.0.0', () => console.log(`🚀 SERVEUR UP | PORT ${port}`));