const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

console.log("------------------------------------------------");
console.log("🚀 DEMARRAGE DU SERVEUR CONDAMINE (ROOT-PATH MODE)");

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

// 5. GESTION DU FRONTEND (PRODUCTION)
// process.cwd() pointe vers la racine du projet (/opt/render/project/src)
const distPath = path.join(process.cwd(), 'client', 'dist');

// Log de debug pour voir ce qui se passe sur Render
console.log("🔍 Vérification du dossier Frontend...");
if (fs.existsSync(distPath)) {
    console.log("✅ Dossier 'dist' trouvé à :", distPath);
} else {
    console.error("❌ Dossier 'dist' INTROUVABLE à :", distPath);
}

app.use(express.static(distPath));

// Fallback pour React
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: "API non trouvée" });
    
    const indexPath = path.join(distPath, 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            res.status(500).send(`Erreur de déploiement : Fichiers statiques non trouvés.`);
        }
    });
});

app.listen(port, () => {
    console.log(`🚀 SERVEUR PRÊT SUR LE PORT ${port}`);
});