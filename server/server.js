const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const nodeFetch = require('node-fetch');
if (!global.fetch) { global.fetch = nodeFetch; }

const express = require('express');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 3000;

// 1. Initialiser les Modèles
require('./models/Schemas');

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ BDD Connectée (V10.2)'))
    .catch(err => console.error("❌ Erreur de connexion MongoDB:", err));

app.use(express.json());

// 2. Routes (On s'assure que l'ordre est bon)
const authRoutes = require('./features/auth/auth.routes');
const eleveRoutes = require('./features/eleve/eleve.routes');
const profRoutes = require('./features/prof/prof.routes');

app.use('/api', authRoutes);
app.use('/api', eleveRoutes);
app.use('/api', profRoutes);

// Servir les fichiers statiques du build client si nécessaire
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(port, () => console.log(`🚀 Serveur V10.2 prêt sur port ${port}`));