// @signatures: SERVER_BOOT_ID, GlobalInfrastructure, KernelV53, OracleMiddleware
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();
const app = express();
const port = 3000;
const SERVER_BOOT_ID = Date.now();

// SÉCURITÉ MONGOOSE (Éviter les avertissements de dépréciation)
mongoose.set('strictQuery', false);

app.use(express.json({ limit: '70mb' }));
app.use(express.urlencoded({ extended: true, limit: '70mb' }));

// ==========================================================
// 🛰️ 1. LOGGER DE TRAFIC (OBSERVABILITÉ)
// ==========================================================
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (res.statusCode >= 400) {
            console.error(`🔴 [${res.statusCode}] ${req.method} ${req.url} - ${duration}ms`);
        } else {
            console.log(`🟢 [${res.statusCode}] ${req.method} ${req.url} - ${duration}ms`);
        }
    });
    next();
});

// ==========================================================
// 🏗️ 2. SERVICES CORE (L'INFRASTRUCTURE)
// ==========================================================

app.get('/api/check-deploy', (req, res) => res.json({ status: "OK", bootId: SERVER_BOOT_ID }));

app.get('/api/system/version', (req, res) => {
    res.json({ hash: "V53-ORACLE", build: 161, mode: "DEBUG_ACTIVE" });
});

app.get('/api/system/apply-status', (req, res) => {
    const statusFile = path.join(__dirname, '../apply_status.json');
    try {
        if (fs.existsSync(statusFile)) {
            const content = fs.readFileSync(statusFile, 'utf8').trim();
            if (content && content.startsWith('{')) return res.json(JSON.parse(content));
        }
        res.json({ status: "OK" });
    } catch (e) { res.json({ status: "OK" }); }
});

// 🚀 PROXY CLOUD CENTRAL (BOULEVARD UNIFIÉ)
const ProfDrive = require('./prof/core/drive.prof');
app.get(['/api/proxy/:id', '/api/structure/proxy/:id'], async (req, res) => {
    const fileId = req.params.id;
    
    if (!fileId || fileId === 'undefined' || fileId === 'null') {
        return res.status(400).send("ID Drive invalide.");
    }

    try {
        const stream = await ProfDrive.getFileStream(fileId);
        res.setHeader('Content-Type', 'image/png');
        stream.pipe(res);
        
        stream.on('error', (err) => {
            console.error(`💥 Erreur de flux pour ${fileId}:`, err.message);
        });
    } catch (e) {
        console.error(`❌ Échec Proxy pour ${fileId}:`, e.message);
        res.status(404).send("Cloud error");
    }
});

// ==========================================================
// 📂 3. CHARGEMENT DES SILOS MÉTIERS
// ==========================================================

// SÉCURITÉ : On s'assure que les modèles sont chargés AVANT les routes
require('./prof/models/prof.models');

app.use('/api/auth', require('./prof/auth/auth.prof'));
app.use('/api/admin', require('./prof/admin/admin.prof'));
app.use('/api/homework', require('./prof/homework/homework.prof'));
app.use('/api/games', require('./prof/games/games.prof'));
app.use('/api/classroom', require('./prof/classroom/classroom.prof'));
app.use('/api/scans', require('./prof/scans/scans.prof'));
app.use('/api/structure', require('./prof/structure/structure.prof'));
app.use('/api/studio', require('./prof/studio/studio.prof')); 

app.use('/api/eleve/auth', require('./eleve/auth/auth.eleve'));
app.use('/api/eleve/homework', require('./eleve/homework/homework.eleve'));
app.use('/api/eleve/classroom', require('./eleve/classroom/classroom.eleve'));
app.use('/api/eleve/games', require('./eleve/games/games.eleve'));

app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// ==========================================================
// ⚖️ 4. L'ORACLE (GESTIONNAIRE D'ERREURS GLOBAL)
// Rôle : Capturer tout crash et l'afficher dans le terminal.
// ==========================================================
app.use((err, req, res, next) => {
    console.error("================================================");
    console.error("🔥 CRASH DÉTECTÉ PAR L'ORACLE");
    console.error(`URL: ${req.method} ${req.url}`);
    console.error("MESSAGE:", err.message);
    console.error("STACK:", err.stack);
    console.error("================================================");
    
    res.status(500).json({
        error: "Erreur Interne du Serveur",
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

const initServices = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("📂 [DB] MongoDB Connecté.");
        app.listen(port, '0.0.0.0', () => {
            console.log(`🚀 [KERNEL V53] OPÉRATIONNEL SUR PORT ${port}`);
        });
    } catch (err) {
        console.error("❌ KERNEL PANIC DURANT LE BOOT:", err.message);
    }
};

initServices();
