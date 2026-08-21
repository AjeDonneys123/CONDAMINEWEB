// @signatures: SERVER_BOOT_ID, GlobalInfrastructure
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fetch = require('node-fetch');
const { getAiGuardStatus } = require('./services/aiGuard.service');
const AIEngine = require('./core/ai.engine');

dotenv.config();
const app = express();
app.set('trust proxy', 1);
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
app.get(['/privacy-gpt', '/privacy'], (_req, res) => {
    res.type('html').send(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Politique de confidentialité - CondaWeb GPT</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.55; max-width: 820px; margin: 0 auto; padding: 32px 18px; color: #172033; }
    h1 { font-size: 28px; }
    h2 { margin-top: 28px; font-size: 18px; }
    p, li { font-size: 15px; }
    code { background: #eef2ff; padding: 2px 5px; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>Politique de confidentialité - CondaWeb GPT</h1>
  <p>Dernière mise à jour : 20 juillet 2026.</p>

  <h2>Données utilisées</h2>
  <p>Le GPT CondaWeb utilise un numéro CondaWeb fourni par l'utilisateur pour récupérer depuis CondaWeb le contexte nécessaire à une révision : identité scolaire minimale, classe, fiche récente, questions éventuelles et statut de validation.</p>

  <h2>Finalité</h2>
  <p>Ces données servent uniquement à permettre au tuteur GPT d'aider l'utilisateur à réviser une fiche et à renvoyer une validation d'apprentissage à CondaWeb lorsque la fiche est maîtrisée.</p>

  <h2>Données envoyées à CondaWeb</h2>
  <p>Lors d'une validation, le GPT peut envoyer à CondaWeb : numéro CondaWeb, nom si connu, classe, type de validation, message court, résumé du travail, points à renforcer, erreurs observées et score indicatif.</p>

  <h2>Conservation</h2>
  <p>Les validations et retours GPT sont enregistrés dans CondaWeb afin que le professeur puisse suivre les apprentissages. Les conversations tenues dans ChatGPT restent gérées par les conditions et paramètres de confidentialité de ChatGPT/OpenAI.</p>

  <h2>Partage</h2>
  <p>CondaWeb ne vend pas ces données. Elles sont utilisées dans le cadre pédagogique CondaWeb et accessibles au professeur concerné.</p>

  <h2>Contact</h2>
  <p>Pour toute demande concernant ces données, contacter JP Vuillet à l'adresse utilisée dans CondaWeb : <code>vuillet.jean@condamine.edu.ec</code>.</p>
</body>
</html>`);
});
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

app.get('/api/system/ai-status', async (req, res) => {
    const configuredProvider = String(process.env.AI_PROVIDER || '').toLowerCase().trim();
    const ollamaServerUrl = String(process.env.OLLAMA_API_SERVER_URL || '').trim().replace(/\/$/, '');
    const provider = configuredProvider || (ollamaServerUrl ? 'ollama_server' : 'gemini');
    const isOllamaServer = ['ollama_server', 'ollama-api', 'ollama_api', 'remote_ollama'].includes(provider);
    const maskUrl = (url) => {
        if (!url) return '';
        try {
            const u = new URL(url);
            return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`;
        } catch (_) {
            return url.replace(/(https?:\/\/)([^/@]+@)?/i, '$1');
        }
    };

    if (!isOllamaServer) {
        return res.json({
            ok: true,
            status: 'OK',
            provider,
            localAi: false,
            message: provider === 'gemini' ? 'IA Gemini active.' : `Fournisseur IA actif: ${provider}.`
        });
    }

    if (!ollamaServerUrl) {
        return res.json({
            ok: false,
            status: 'ERROR',
            provider,
            localAi: true,
            message: 'AI_PROVIDER demande le serveur Ollama, mais OLLAMA_API_SERVER_URL est absent.'
        });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
        const response = await fetch(`${ollamaServerUrl}/health`, { signal: controller.signal });
        const data = response.ok ? await response.json().catch(() => ({})) : {};
        return res.json({
            ok: response.ok,
            status: response.ok ? 'OK' : 'ERROR',
            provider,
            localAi: true,
            url: maskUrl(ollamaServerUrl),
            defaultModel: data?.defaultModel || process.env.OLLAMA_API_MODEL || process.env.OLLAMA_MODEL || '',
            models: Array.isArray(data?.models) ? data.models.slice(0, 12) : [],
            elapsedMs: data?.elapsedMs,
            message: response.ok
                ? 'Serveur Ollama local joignable.'
                : `Serveur Ollama non joignable (${response.status}).`
        });
    } catch (e) {
        return res.json({
            ok: false,
            status: 'ERROR',
            provider,
            localAi: true,
            url: maskUrl(ollamaServerUrl),
            message: `Serveur Ollama non joignable: ${e.message}`
        });
    } finally {
        clearTimeout(timeout);
    }
});

app.post('/api/system/ai-diagnostic', async (req, res) => {
    const startedAt = Date.now();
    const maskSecret = (value) => {
        const str = String(value || '').trim();
        if (!str) return { present: false, length: 0, preview: '' };
        return { present: true, length: str.length };
    };
    const maskUrl = (url) => {
        if (!url) return '';
        try {
            const u = new URL(url);
            return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`;
        } catch (_) {
            return String(url).replace(/(https?:\/\/)([^/@]+@)?/i, '$1');
        }
    };
    const runStep = async (label, fn) => {
        const t0 = Date.now();
        try {
            const data = await fn();
            return { label, ok: true, ms: Date.now() - t0, ...data };
        } catch (e) {
            return {
                label,
                ok: false,
                ms: Date.now() - t0,
                error: String(e?.message || e || 'Erreur inconnue').slice(0, 1000)
            };
        }
    };
    const timeoutSignal = (ms) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), ms);
        return { signal: controller.signal, clear: () => clearTimeout(timeout) };
    };

    const provider = String(process.env.AI_PROVIDER || '').toLowerCase().trim() || 'gemini';
    const ollamaUrl = String(process.env.OLLAMA_API_SERVER_URL || '').trim().replace(/\/$/, '');
    const ollamaKey = String(process.env.OLLAMA_API_KEY || '').trim();
    const ollamaModel = String(process.env.OLLAMA_API_MODEL || process.env.OLLAMA_MODEL || 'llama3.1:8b').trim();
    const geminiKey = String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_API_KEY || '').trim();
    const geminiModel = String(process.env.GEMINI_MODEL || 'gemini-flash-latest').trim();
    const correctionPrompt = [
        'Réponds uniquement en JSON strict.',
        'Corrige cette mini-réponse DNB et renvoie un JSON court avec exactement les clés suivantes:',
        '{"score":0,"max_score":20,"score_label":"0/20","grade":"A|B|C","copie_annotee":[{"extrait_eleve":"","correction":"","conseil":"","statut":"bon|partiel|faux"}],"bareme":[{"item":"","points":0,"max":0,"comment":""}],"attentes":[""],"reussites":[""],"manques":[""],"feedback_fond":""}',
        'Important: maximum 1 élément par tableau et phrases courtes.',
        '',
        'Consigne: Relevez un extrait qui définit une gigafactory.',
        'Correction attendue: usine de fabrication de batteries et de leurs composants.',
        'Réponse élève: ces usines de fabrication de batteries et de leurs composants'
    ].join('\n');

    const steps = [];
    steps.push(await runStep('Configuration serveur', async () => ({
        provider,
        ollama: {
            url: maskUrl(ollamaUrl),
            key: maskSecret(ollamaKey),
            model: ollamaModel
        },
        gemini: {
            key: maskSecret(geminiKey),
            model: geminiModel
        }
    })));

    steps.push(await runStep('Ollama health', async () => {
        if (!ollamaUrl) throw new Error('OLLAMA_API_SERVER_URL absent');
        const timer = timeoutSignal(7000);
        try {
            const response = await fetch(`${ollamaUrl}/health`, { signal: timer.signal });
            const text = await response.text();
            let json = null;
            try { json = JSON.parse(text); } catch (_) {}
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
            return { status: response.status, body: json || text.slice(0, 500) };
        } finally {
            timer.clear();
        }
    }));

    steps.push(await runStep('Ollama JSON correction', async () => {
        if (!ollamaUrl) throw new Error('OLLAMA_API_SERVER_URL absent');
        if (!ollamaKey) throw new Error('OLLAMA_API_KEY absent');
        const timer = timeoutSignal(35000);
        try {
            const response = await fetch(`${ollamaUrl}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': ollamaKey },
                signal: timer.signal,
                body: JSON.stringify({
                    model: ollamaModel,
                    messages: [
                        { role: 'system', content: 'Tu es un correcteur DNB. Tu réponds uniquement en JSON strict.' },
                        { role: 'user', content: correctionPrompt }
                    ],
                    options: { temperature: 0, num_predict: 650 }
                })
            });
            const text = await response.text();
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 800)}`);
            let payload = {};
            try { payload = JSON.parse(text); } catch (_) {}
            const raw = String(payload?.message?.content || text || '').trim();
            const parsed = AIEngine.sanitizeJSON(raw);
            return {
                model: ollamaModel,
                rawPreview: raw.slice(0, 900),
                parsedOk: !!parsed,
                parsed
            };
        } finally {
            timer.clear();
        }
    }));

    steps.push(await runStep('Gemini JSON correction', async () => {
        if (!geminiKey) throw new Error('GEMINI_API_KEY / GOOGLE_API_KEY absent');
        const timer = timeoutSignal(35000);
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': geminiKey
                },
                signal: timer.signal,
                body: JSON.stringify({
                    generationConfig: { temperature: 0, maxOutputTokens: 4096, responseMimeType: 'application/json' },
                    systemInstruction: { parts: [{ text: 'Tu es un correcteur DNB. Tu réponds uniquement en JSON strict.' }] },
                    contents: [{ role: 'user', parts: [{ text: correctionPrompt }] }]
                })
            });
            const data = await response.json().catch(async () => ({ raw: await response.text().catch(() => '') }));
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(data).slice(0, 1000)}`);
            const candidate = data?.candidates?.[0] || {};
            const raw = String(candidate?.content?.parts?.map((p) => p?.text || '').join('\n') || '').trim();
            const parsed = AIEngine.sanitizeJSON(raw);
            return {
                model: geminiModel,
                finishReason: candidate?.finishReason || '',
                rawLength: raw.length,
                rawPreview: raw.slice(0, 1800),
                parsedOk: !!parsed,
                parsed
            };
        } finally {
            timer.clear();
        }
    }));

    res.json({
        ok: steps.every((step) => step.ok),
        generatedAt: new Date().toISOString(),
        totalMs: Date.now() - startedAt,
        steps
    });
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
safeLoad('/api/training-config', './training/training.routes');

safeLoad('/api/eleve/auth', './eleve/auth/auth.eleve');
safeLoad('/api/eleve/homework', './eleve/homework/homework.eleve');
safeLoad('/api/eleve/classroom', './eleve/classroom/classroom.eleve');
safeLoad('/api/eleve/games', './eleve/games/games.eleve');
safeLoad('/api/eleve/learning', './eleve/learning/learning.eleve');
safeLoad('/api/eleve/control-recovery', './eleve/control-recovery/controlRecovery.eleve');
safeLoad('/api/eleve/exposes', './eleve/exposes/exposes.eleve');
safeLoad('/api/eleve/lectures', './eleve/lectures/lectures.eleve');
safeLoad('/api/eleve/courses', './eleve/courses/courses.eleve');
safeLoad('/api/eleve/fiches', './eleve/fiches/fiches.eleve');
safeLoad('/api/eleve/productions', './eleve/productions/productions.eleve');
safeLoad('/api/eleve/comments', './eleve/comments/comments.eleve');
safeLoad('/api/eleve/revisions', './eleve/revisions/revisions.eleve');
safeLoad('/api/eleve/chat', './eleve/chat/chat.eleve');
safeLoad('/api/eleve/dil', './eleve/dil/dil.eleve');
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
