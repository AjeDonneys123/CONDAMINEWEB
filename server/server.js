const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 3000;

console.log("------------------------------------------------");
console.log("🚀 DÉMARRAGE SERVEUR (ROUTES RÉPARÉES)");

// Modèles
try { require('./models/Schemas'); } catch(e) { console.error(e); }

// BDD
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ BDD Connectée.'))
    .catch(err => console.error("❌ Erreur MongoDB:", err));

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// CHARGEMENT DES ROUTES (Ordre important)
try {
    app.use('/api', require('./features/auth/auth.routes'));
    app.use('/api', require('./features/eleve/eleve.routes'));
    app.use('/api', require('./features/prof/prof.routes')); // Contient Bugs, Players, Homeworks
    app.use('/api', require('./features/game/game.routes')); // Contient Game Levels, AI Gen
    console.log("✅ Toutes les routes sont actives (Prof, Game, Eleve, Auth).");
} catch (e) {
    console.error("❌ CRASH Chargement Routes :", e);
}

app.listen(port, () => console.log(`🚀 Prêt sur le port ${port}`));