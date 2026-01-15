const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();
if (!global.fetch) global.fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 3000;

// FIX SYNC : On définit l'ID de boot UNE SEULE FOIS au démarrage
const SERVER_BOOT_ID = Date.now();

// MODELES
require('./models/Teacher');
require('./models/Player');
require('./models/Chapter');
require('./models/Homework');
require('./models/GameLevel');
require('./models/Submission');

mongoose.connect(process.env.MONGODB_URI).then(() => console.log('✅ MongoDB Condamine Connecté'));

app.use(express.json({ limit: '50mb' }));

// ROUTES
app.use('/api/auth', require('./features/auth/auth.routes'));
app.use('/api/structure', require('./features/structure/structure.routes'));
app.use('/api/games', require('./features/games/games.routes'));
app.use('/api/homework', require('./features/homework/homework.routes'));
app.use('/api/admin', require('./features/admin/admin.routes'));

// La route renvoie maintenant toujours le même ID tant que le serveur ne redémarre pas
app.get('/api/check-deploy', (req, res) => res.json({ bootId: SERVER_BOOT_ID }));

const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(port, () => console.log(`🚀 CONDAMINE PRO ACTIF SUR PORT ${port}`));