const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 3000;

console.log("------------------------------------------------");
console.log("🚑 RESTAURATION DU SERVEUR...");

// 1. Connexion BDD
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ BDD Connectée.'))
    .catch(err => console.error("❌ CRITIQUE : Erreur MongoDB :", err));

// 2. Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// 3. Chargement des Modèles (Vital)
try {
    require('./models/Schemas');
    console.log("✅ Modèles chargés.");
} catch(e) {
    console.error("❌ Erreur chargement Modèles :", e);
}

// 4. Chargement des Routes
try {
    app.use('/api', require('./features/auth/auth.routes'));
    app.use('/api', require('./features/eleve/eleve.routes'));
    app.use('/api', require('./features/prof/prof.routes'));
    app.use('/api', require('./features/game/game.routes'));
    console.log("✅ Routes chargées avec succès.");
} catch (e) {
    console.error("❌ CRITIQUE : Une route a fait planter le chargement :", e);
}

// 5. Démarrage
app.listen(port, () => console.log(`🚀 SERVEUR OPÉRATIONNEL SUR LE PORT ${port}`));