const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 3000;

console.log("------------------------------------------------");
console.log("🚑 DÉMARRAGE DU SERVEUR CONDAMINE...");

// 1. Connexion BDD
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ BDD Connectée.'))
    .catch(err => console.error("❌ Erreur MongoDB :", err));

// 2. Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// 3. Modèles (Chargement individuel pour plus de sécurité)
require('./models/Player');
require('./models/Chapter');
require('./models/Homework');
require('./models/GameLevel');
require('./models/Bug');
require('./models/Submission');
console.log("✅ Modèles chargés.");

// 4. Montage des Routes
// On utilise une route de secours pour tester la connexion
app.get('/api/hello', (req, res) => res.json({ ok: true, message: "Le serveur répond !" }));

try {
    app.use('/api', require('./features/auth/auth.routes'));
    app.use('/api', require('./features/eleve/eleve.routes'));
    app.use('/api', require('./features/prof/prof.routes'));
    app.use('/api', require('./features/game/game.routes'));
    app.use('/api', require('./features/prof/automation.routes'));
    console.log("✅ Toutes les routes API sont branchées.");
} catch (e) {
    console.error("❌ ERREUR BRANCHEMENT :", e.message);
}

app.listen(port, () => {
    console.log(`🚀 SERVEUR PRÊT SUR : http://localhost:${port}`);
});