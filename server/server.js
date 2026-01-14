const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const SERVER_BOOT_ID = Date.now();

// 1. CHARGEMENT DES MODÈLES
require('./models/Teacher');
require('./models/Player');
require('./models/Chapter');
require('./models/Homework');
require('./models/GameLevel');
require('./models/Bug');
require('./models/Submission');
require('./models/TeacherStyle');
require('./models/ScanSession');
require('./models/DeploySignal');

// 2. CONNEXION MONGODB
mongoose.connect(process.env.MONGODB_URI).then(async () => {
    console.log('✅ MongoDB Connecté.');
    try {
        await mongoose.model('DeploySignal').findOneAndUpdate({}, { status: 'live', updatedAt: new Date() }, { upsert: true });
    } catch (e) {}
}).catch(err => console.error("❌ Erreur MongoDB :", err.message));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 3. ROUTES SYSTÈME
app.get('/api/check-deploy', (req, res) => res.json({ bootId: SERVER_BOOT_ID }));
app.get('/api/system-status', (req, res) => res.json({ status: 'OK' }));

// 4. ARCHITECTURE MODULAIRE : ENREGISTREMENT DES TIROIRS
// Chaque fichier est totalement indépendant
app.use('/api', require('./features/auth/auth.routes'));       // Login
app.use('/api', require('./features/eleve/eleve.routes'));     // Espace Elève
app.use('/api', require('./features/game/game.routes'));       // Jeux & IA Quizz
app.use('/api', require('./features/prof/teacher.routes'));    // Profil Prof & Classes
app.use('/api', require('./features/prof/chapter.routes'));    // Dossiers & Archives
app.use('/api', require('./features/prof/homework.routes'));   // Devoirs Manuels
app.use('/api', require('./features/prof/scan.routes'));       // Photos & Drive Scans

// 5. GARDE-FOU API
app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `Route non trouvée : ${req.method} ${req.url}` });
});

// 6. GESTION FRONTEND
const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(port, () => console.log(`🚀 SERVEUR MODULAIRE PRÊT : PORT ${port}`));