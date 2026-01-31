// @signatures: SERVER_BOOT_ID, RobustSystem, FinalRepairV14
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

dotenv.config();
const app = express();
const port = 3000;
const SERVER_BOOT_ID = Date.now();

// 1. MIDDLEWARES VITAUX (DOIVENT ÊTRE EN PREMIER)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// 2. ROUTES DE DIAGNOSTIC PRIORITAIRES (SANS BDD / SANS MODÈLES)
// Ces routes doivent répondre même si tout le reste est en panne
app.get('/api/check-deploy', (req, res) => res.json({ status: "OK", bootId: SERVER_BOOT_ID }));

app.get('/api/system/version', (req, res) => {
    try {
        const vPath = path.join(__dirname, 'version.json');
        if (fs.existsSync(vPath)) {
            const v = JSON.parse(fs.readFileSync(vPath, 'utf8'));
            return res.json({ hash: `V8.${v.build || 0}`, build: v.build });
        }
        res.json({ hash: "V8.0" });
    } catch (e) { res.json({ hash: "V8.ERROR" }); }
});

app.get('/api/system/apply-status', (req, res) => {
    try {
        if (fs.existsSync('apply_status.json')) {
            return res.json(JSON.parse(fs.readFileSync('apply_status.json', 'utf8')));
        }
        res.json({ status: "OK" });
    } catch (e) { res.status(500).json({ status: "ERROR" }); }
});

// ✅ FIX 404 : DEPLACEMENT DE L'ORACLE ET DU REVERT ICI (V14)
app.post('/api/system/oracle', (req, res) => {
    res.json({ verdict: "SAFE", reason: "Infrastructure Mongoose stabilisée en V7." });
});

app.post('/api/system/revert', (req, res) => {
    console.log("🚑 EMERGENCY REVERT TRIGGERED");
    exec('git reset --hard HEAD', (err) => {
        if (err) return res.status(500).json({ error: "Revert failed" });
        res.json({ ok: true });
        setTimeout(() => process.exit(0), 500);
    });
});

/**
 * 🏰 INITIALISATION SÉCURISÉE DES DONNÉES
 */
const startServer = async () => {
    try {
        // Connexion MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("📂 BDD CONNECTÉE");

        // CHARGEMENT DES MODÈLES (VITAL : AVANT LES ROUTEURS)
        require('./prof/models/prof.models');

        // MONTAGE DES SILOS
        app.use('/api/structure', require('./prof/structure/structure.prof'));
        app.use('/api/prof/structure', require('./prof/structure/structure.prof')); 
        app.use('/api/auth', require('./prof/auth/auth.prof'));
        app.use('/api/admin', require('./prof/admin/admin.prof'));
        app.use('/api/homework', require('./prof/homework/homework.prof'));
        app.use('/api/games', require('./prof/games/games.prof.js'));
        app.use('/api/classroom', require('./prof/classroom/classroom.prof.js'));
        app.use('/api/scans', require('./prof/scans/scans.prof.js'));
        app.use('/api/studio', require('./prof/studio/studio.prof.js'));

        app.use('/api/eleve/homework', require('./eleve/homework/homework.eleve'));
        
        // STATIQUE
        app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

        // GESTIONNAIRE D'ERREURS FINAL
        app.use((err, req, res, next) => {
            console.error("💥 CRASH ROUTE:", req.url, err.message);
            res.status(500).json({ status: "ERROR", message: err.message });
        });

        app.listen(port, '0.0.0.0', () => {
            console.log(`🚀 SERVEUR CONDAMINE V14 : PORT ${port}`);
        });

    } catch (err) {
        console.error("❌ ÉCHEC DÉMARRAGE CRITIQUE:", err.message);
        // On ne tue pas le processus ici pour laisser les routes de diagnostic (ci-dessus) fonctionner
    }
};

startServer();
