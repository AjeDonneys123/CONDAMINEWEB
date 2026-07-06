// @signatures: SERVER_BOOT_ID, GlobalInfrastructure
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { getAiGuardStatus } = require('./services/aiGuard.service');

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || '0.0.0.0';
const SERVER_BOOT_ID = Date.now();
let shuttingDown = false;
let mongoRetryTimer = null;

process.on('uncaughtException', (err) => {
    console.error('💥 UNCAUGHT EXCEPTION:', err?.stack || err?.message || err);
});

process.on('unhandledRejection', (reason) => {
    console.error('💥 UNHANDLED REJECTION:', reason?.stack || reason?.message || reason);
});

console.log("------------------------------------------------");
console.log("🚀 KERNEL V88 : STABILIZATION RECOVERY");
console.log("------------------------------------------------");

app.use(express.json({ limit: '70mb' }));
app.use(express.urlencoded({ extended: true, limit: '70mb' }));

// 1. CHARGEMENT MODÈLES CRITIQUE
try {
    console.log("📦 Chargement des Modèles...");
    require('./prof/models/prof.models');
    require('./models/Enrollment');
    require('./web5e/models.web5e');
    console.log("✅ Modèles chargés.");
} catch (e) {
    console.error("💥 ERREUR CRITIQUE MODÈLES :", e.message);
}

// 2. ROUTES SYSTÈME
app.get('/api/check-deploy', (req, res) => res.json({ status: "OK", bootId: SERVER_BOOT_ID }));
app.get('/api/system/apply-status', async (req, res) => {
    try {
        const ai = await getAiGuardStatus({});
        if (ai.blocked) {
            return res.json({
                status: 'ERROR',
                message: "Quota IA gratuit consommé: génération bloquée.",
                details: `${ai.spentUsd.toFixed(4)}$ / ${ai.budgetUsd.toFixed(2)}$ aujourd'hui`
            });
        }
        if (ai.warning) {
            return res.json({
                status: 'WARNING',
                message: "Quota IA presque consommé aujourd'hui.",
                details: `${ai.remainingUsd.toFixed(3)}$ restants (${ai.remainingPct.toFixed(1)}%)`
            });
        }
        return res.json({ status: "OK", message: "Kernel Stable" });
    } catch (_) {
        return res.json({ status: "OK", message: "Kernel Stable" });
    }
});

// 3. PROXY RAW
const ProfDrive = require('./prof/core/drive.prof');
app.get(['/api/proxy/:id', '/api/structure/proxy/:id', '/api/prof/structure/proxy/:id'], async (req, res) => {
    try {
        const fileId = req.params.id;
        if (!fileId || fileId === 'undefined') {
            return res.status(404).json({ error: "Drive fileId missing" });
        }
        const range = String(req.headers.range || '').trim();
        const upstream = await ProfDrive.getFileResponse(fileId, range);
        const status = upstream.status >= 200 && upstream.status < 600 ? upstream.status : (range ? 206 : 200);

        // Forward key streaming headers so HTML5 video can seek.
        const h = upstream.headers || {};
        if (h['content-type']) res.setHeader('Content-Type', h['content-type']);
        if (h['content-length']) res.setHeader('Content-Length', h['content-length']);
        if (h['content-range']) res.setHeader('Content-Range', h['content-range']);
        if (h['accept-ranges']) res.setHeader('Accept-Ranges', h['accept-ranges']);
        else res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(status);
        upstream.stream.pipe(res);
    } catch (e) {
        const status = e?.response?.status || e?.code || null;
        console.error(`❌ [DRIVE PROXY] fileId=${req.params.id} status=${status || 'unknown'} msg=${e.message}`);
        if (status === 404 || status === '404') {
            return res.status(404).json({ error: "Drive file not found", fileId: req.params.id });
        }
        if (status === 401 || status === 403 || status === '401' || status === '403') {
            return res.status(502).json({ error: "Drive upstream auth error", fileId: req.params.id });
        }
        return res.status(500).json({ error: "Drive proxy failure", fileId: req.params.id });
    }
});

// 4. CHARGEMENT DES SILOS (Avec protection Try/Catch)
const safeLoad = (route, path) => {
    try { app.use(route, require(path)); } 
    catch (e) { console.error(`❌ Échec chargement ${route}:`, e.message); }
};

safeLoad('/api/auth', './prof/auth/auth.prof');
safeLoad('/api/admin', './prof/admin/admin.prof');
safeLoad('/api/homework', './prof/homework/homework.prof');
safeLoad('/api/games', './prof/games/games.prof');
safeLoad('/api/learning', './prof/learning/learning.prof');
safeLoad('/api/exposes', './prof/exposes/exposes.prof');
safeLoad('/api/courses', './prof/courses/courses.prof');
safeLoad('/api/lectures', './prof/lectures/lectures.prof');
safeLoad('/api/fiches', './prof/fiches/fiches.prof');
safeLoad('/api/productions', './prof/productions/productions.prof');
safeLoad('/api/comments', './prof/comments/comments.prof');
safeLoad('/api/revisions', './prof/revisions/revisions.prof');
safeLoad('/api/classroom', './prof/classroom/classroom.prof');
safeLoad('/api/scans', './prof/scans/scans.prof');
safeLoad('/api/structure', './prof/structure/structure.prof');
safeLoad('/api/studio', './prof/studio/studio.prof');

safeLoad('/api/eleve/auth', './eleve/auth/auth.eleve');
safeLoad('/api/eleve/homework', './eleve/homework/homework.eleve');
safeLoad('/api/eleve/classroom', './eleve/classroom/classroom.eleve');
safeLoad('/api/eleve/games', './eleve/games/games.eleve');
safeLoad('/api/eleve/learning', './eleve/learning/learning.eleve');
safeLoad('/api/eleve/control-recovery', './eleve/control-recovery/controlRecovery.eleve');
safeLoad('/api/eleve/exposes', './eleve/exposes/exposes.eleve');
safeLoad('/api/eleve/lectures', './eleve/lectures/lectures.eleve');
safeLoad('/api/eleve/fiches', './eleve/fiches/fiches.eleve');
safeLoad('/api/eleve/productions', './eleve/productions/productions.eleve');
safeLoad('/api/eleve/comments', './eleve/comments/comments.eleve');
safeLoad('/api/eleve/revisions', './eleve/revisions/revisions.eleve');
safeLoad('/api/web5e', './web5e/web5e.routes');

app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

// 5. DEMARRAGE SERVEUR + RECONNEXION MONGOOSE
const server = app.listen(port, host, () => console.log(`🏁 PRET SUR ${host}:${port}`));
server.on('error', (err) => {
    console.error(`💥 ERREUR DEMARRAGE HTTP ${host}:${port}:`, err.message);
});

const connectMongoWithRetry = async (delayMs = 10000) => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("📂 MongoDB Connecté.");
    } catch (err) {
        console.error("❌ Erreur Connexion MongoDB:", err);
        console.log(`⏳ Nouvelle tentative MongoDB dans ${Math.floor(delayMs / 1000)}s...`);
        if (shuttingDown) return;
        mongoRetryTimer = setTimeout(() => connectMongoWithRetry(delayMs), delayMs);
    }
};

connectMongoWithRetry();

const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`🛑 Arret recu (${signal}). Fermeture propre du serveur...`);
    if (mongoRetryTimer) {
        clearTimeout(mongoRetryTimer);
        mongoRetryTimer = null;
    }
    try {
        await new Promise((resolve) => server.close(() => resolve()));
    } catch (_) {}
    try {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close(false);
        }
    } catch (_) {}
    process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
