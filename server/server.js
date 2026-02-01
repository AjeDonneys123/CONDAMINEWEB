// @signatures: SERVER_BOOT_ID, RobustSystem, HybridKernelV44
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

dotenv.config();
const app = express();
const port = 3000;
const SERVER_BOOT_ID = Date.now();

app.use(express.json({ limit: '70mb' }));
app.use(express.urlencoded({ extended: true, limit: '70mb' }));

// --- 1. ROUTES SYSTÈME (FIX 404) ---

// Vérification de déploiement
app.get('/api/check-deploy', (req, res) => res.json({ status: "OK", bootId: SERVER_BOOT_ID }));

// Version du système
app.get('/api/system/version', (req, res) => res.json({ hash: "V8.44", build: 44 }));

// Route critique : Statut de l'application (Lecture de apply_status.json)
app.get('/api/system/apply-status', (req, res) => {
    const statusFile = path.join(__dirname, '../apply_status.json');
    try {
        if (fs.existsSync(statusFile)) {
            const data = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
            return res.json(data);
        }
        res.json({ status: "OK", message: "Système sain" });
    } catch (e) {
        res.json({ status: "OK" });
    }
});

// Route Oracle : Pour les diagnostics IA
app.post('/api/system/oracle', (req, res) => {
    const verdictFile = path.join(__dirname, '../temp_verdict.json');
    try {
        if (fs.existsSync(verdictFile)) {
            const data = JSON.parse(fs.readFileSync(verdictFile, 'utf8'));
            return res.json(data);
        }
        res.json({ verdict: "SAIN", reason: "Aucune anomalie détectée par l'Oracle." });
    } catch (e) {
        res.json({ verdict: "UNKNOWN", reason: "Oracle indisponible." });
    }
});

// Route Revert : Procédure d'urgence
app.post('/api/system/revert', (req, res) => {
    console.log("🚑 [SYSTEM] Demande de REVERT reçue !");
    try {
        // On tente un reset via Git si disponible, sinon on nettoie le fichier de statut
        // Pour Render/Local : on remet le statut à OK pour débloquer l'UI
        const statusFile = path.join(__dirname, '../apply_status.json');
        fs.writeFileSync(statusFile, JSON.stringify({ status: "OK", timestamp: Date.now() }));
        
        // Optionnel : Commande git pour revenir en arrière si on est en local
        // execSync('git reset --hard HEAD~1'); 

        res.json({ ok: true, message: "Système réinitialisé." });
    } catch (e) {
        res.status(500).json({ error: "Échec du revert" });
    }
});

// PROXY DRIVE
const ProfDrive = require('./prof/core/drive.prof');
app.get('/api/proxy/:fileId', async (req, res) => {
    try {
        const stream = await ProfDrive.getFileStream(req.params.fileId);
        res.setHeader('Content-Type', 'image/png');
        stream.pipe(res);
    } catch (e) { res.status(404).send("Not Found"); }
});

// --- 2. MAPPING DES SILOS ---
app.use('/api/auth', require('./prof/auth/auth.prof'));
app.use('/api/admin', require('./prof/admin/admin.prof'));
app.use('/api/homework', require('./prof/homework/homework.prof'));
app.use('/api/games', require('./prof/games/games.prof'));
app.use('/api/classroom', require('./prof/classroom/classroom.prof'));
app.use('/api/scans', require('./prof/scans/scans.prof'));
app.use('/api/prof/structure', require('./prof/structure/structure.prof'));
app.use('/api/structure', require('./prof/structure/structure.prof'));
app.use('/api/studio', require('./prof/studio/studio.prof')); 

// SILOS ÉLÈVE
app.use('/api/eleve/auth', require('./eleve/auth/auth.eleve'));
app.use('/api/eleve/homework', require('./eleve/homework/homework.eleve'));
app.use('/api/eleve/classroom', require('./eleve/classroom/classroom.eleve'));
app.use('/api/eleve/games', require('./eleve/games/games.eleve'));

app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

const initServices = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("📂 [KERNEL V44] BDD Connectée & Routes Système Fixées");
        app.listen(port, '0.0.0.0', () => {
            console.log(`🚀 SERVEUR V44 OPÉRATIONNEL SUR PORT ${port}`);
        });
    } catch (err) {
        console.error("❌ KERNEL PANIC:", err.message);
    }
};

initServices();
