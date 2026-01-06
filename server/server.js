const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 3000;

console.log("------------------------------------------------");
console.log("🚑 SYNC SERVEUR EN COURS...");

// 1. Connexion BDD
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ BDD Connectée.'))
    .catch(err => console.error("❌ CRITIQUE : Erreur MongoDB :", err));

// 2. Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// 3. Chargement des Modèles
try {
    require('./models/Schemas');
    console.log("✅ Modèles chargés.");
} catch(e) {
    console.error("❌ Erreur Modèles :", e);
}

// 4. Chargement des Routes (L'ordre est important)
try {
    // Note : toutes les routes prof, élèves et auth sont montées sur /api
    app.use('/api', require('./features/auth/auth.routes'));
    app.use('/api', require('./features/eleve/eleve.routes'));
    app.use('/api', require('./features/prof/prof.routes'));
    app.use('/api', require('./features/game/game.routes'));
    console.log("✅ Routes API opérationnelles.");
} catch (e) {
    console.error("❌ CRITIQUE : Erreur chargement routes :", e);
}

// 5. Démarrage
app.listen(port, () => console.log(`🚀 SERVEUR PRÊT SUR LE PORT ${port}`));