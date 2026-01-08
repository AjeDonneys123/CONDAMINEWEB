const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 3000;

console.log("------------------------------------------------");
console.log("🚀 DEMARRAGE DU SERVEUR CONDAMINE (MODE PROD)");

// 1. Connexion BDD
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ BDD Connectée.'))
    .catch(err => console.error("❌ Erreur MongoDB :", err));

// 2. Middlewares
app.use(express.json());

// 3. Modèles
require('./models/Player');
require('./models/Chapter');
require('./models/Homework');
require('./models/GameLevel');
require('./models/Bug');
require('./models/Submission');

// 4. Routes API
app.use('/api', require('./features/auth/auth.routes'));
app.use('/api', require('./features/eleve/eleve.routes'));
app.use('/api', require('./features/prof/prof.routes'));
app.use('/api', require('./features/game/game.routes'));
app.use('/api', require('./features/prof/automation.routes'));

// 5. GESTION DU FRONTEND EN PRODUCTION
// On sert les fichiers statiques du dossier 'client/dist'
const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distPath));

// Pour toute route non-API (ex: /dashboard), on renvoie l'index.html de React
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return; // Sécurité pour les erreurs 404 API
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
        if (err) {
            res.status(500).send("Le Frontend n'est pas encore compilé. Lancez 'npm run build'.");
        }
    });
});

app.listen(port, () => {
    console.log(`🚀 SERVEUR PRÊT SUR LE PORT ${port}`);
});