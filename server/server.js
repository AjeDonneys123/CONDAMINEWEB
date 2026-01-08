const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 3000;

console.log("------------------------------------------------");
console.log("🚀 DEMARRAGE DU SERVEUR CONDAMINE (DEPLOYMENT MODE)");

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

// 5. GESTION DU FRONTEND
// Render compile le client dans client/dist
const distPath = path.resolve(__dirname, '..', 'client', 'dist');
console.log("📁 Chemin statique recherché :", distPath);

app.use(express.static(distPath));

// Fallback pour les routes React (SPA)
app.get('*', (req, res) => {
    // Si c'est une requête API qui arrive ici, c'est une 404 API
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: "Route API inconnue" });
    }
    // Sinon on envoie le fichier index.html du build
    const indexPath = path.join(distPath, 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error("❌ Erreur SendFile :", err.message);
            res.status(500).send(`Erreur de déploiement : Le fichier index.html est introuvable à l'adresse : ${indexPath}. Vérifiez les logs de build sur Render.`);
        }
    });
});

app.listen(port, () => {
    console.log(`🚀 SERVEUR PRÊT SUR LE PORT ${port}`);
});