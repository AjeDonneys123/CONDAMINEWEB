// @signatures: SERVER_BOOT_ID, GlobalInfrastructure, KernelV54_DEBUG
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

console.log("------------------------------------------------");
console.log("🚀 DÉMARRAGE DU SERVEUR (MODE DEBUG V54)");
console.log("------------------------------------------------");

dotenv.config();
const app = express();
const port = 3000;
const SERVER_BOOT_ID = Date.now();

mongoose.set('strictQuery', false);

app.use(express.json({ limit: '70mb' }));
app.use(express.urlencoded({ extended: true, limit: '70mb' }));

// 1. LOGGER
app.use((req, res, next) => {
    console.log(`📥 REQ: ${req.method} ${req.url}`);
    next();
});

// 2. ROUTES SYSTÈME (Doivent marcher même si le reste plante)
app.get('/api/check-deploy', (req, res) => {
    console.log("✅ Check-Deploy OK");
    res.json({ status: "OK", bootId: SERVER_BOOT_ID });
});

app.get('/api/system/version', (req, res) => res.json({ hash: "V54-DEBUG", build: 162 }));

app.get('/api/system/apply-status', (req, res) => {
    try {
        const p = path.join(__dirname, '../apply_status.json');
        if (fs.existsSync(p)) res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
        else res.json({ status: "OK" });
    } catch (e) { res.json({ status: "OK" }); }
});

// 3. CHARGEMENT DES SILOS (Avec Logs)
const loadRoute = (pathRel, routeName) => {
    try {
        console.log(`⏳ Chargement ${routeName}...`);
        const r = require(pathRel);
        app.use(`/api/${routeName}`, r);
        console.log(`   ✅ ${routeName} chargé.`);
    } catch (e) {
        console.error(`   ❌ ÉCHEC ${routeName}:`, e.message);
        console.error(e.stack);
    }
};

try {
    // Modèles
    require('./prof/models/prof.models');
    console.log("✅ Modèles chargés.");

    // Routes
    loadRoute('./prof/auth/auth.prof', 'auth');
    loadRoute('./prof/admin/admin.prof', 'admin');
    loadRoute('./prof/homework/homework.prof', 'homework');
    loadRoute('./prof/games/games.prof', 'games');      // <--- C'EST SOUVENT LUI
    loadRoute('./prof/classroom/classroom.prof', 'classroom');
    loadRoute('./prof/scans/scans.prof', 'scans');
    loadRoute('./prof/structure/structure.prof', 'structure');
    loadRoute('./prof/studio/studio.prof', 'studio');
    
    // Routes Elève
    loadRoute('./eleve/auth/auth.eleve', 'eleve/auth');
    loadRoute('./eleve/homework/homework.eleve', 'eleve/homework');
    loadRoute('./eleve/classroom/classroom.eleve', 'eleve/classroom');
    loadRoute('./eleve/games/games.eleve', 'eleve/games');

} catch (globalErr) {
    console.error("💥 CRASH GLOBAL CHARGEMENT:", globalErr);
}

app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// 4. L'ORACLE (VERSION BAVARDE)
app.use((err, req, res, next) => {
    console.error("🔥 ERREUR 500 CATCHÉE :");
    console.error(err);
    
    // On renvoie l'erreur au client pour que tu puisses la lire dans l'inspecteur
    res.status(500).json({
        error: "CRASH SERVEUR",
        message: err.message,
        stack: err.stack,
        where: "Middleware Global Oracle"
    });
});

const initServices = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("📂 MongoDB Connecté.");
        app.listen(port, '0.0.0.0', () => {
            console.log(`🏁 SERVEUR PRÊT SUR LE PORT ${port}`);
        });
    } catch (err) {
        console.error("❌ ECHEC CONNEXION DB:", err.message);
    }
};

initServices();
