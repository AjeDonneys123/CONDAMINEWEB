const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const fetchNode = require('node-fetch');
const FormData = require('form-data');
const {
    Web5eSite,
    Web5eTab,
    Web5eEntry,
    Web5eActor,
    Web5eAnimation,
    Web5eAudio,
    Web5eMobileActionAccess
} = require('./models.web5e');

const router = express.Router();
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'web5e-mobile');
fs.mkdirSync(uploadDir, { recursive: true });
const ttsUploadDir = path.join(process.cwd(), 'public', 'uploads', 'web5e-tts');
fs.mkdirSync(ttsUploadDir, { recursive: true });
const cutoutUploadDir = path.join(process.cwd(), 'public', 'uploads', 'web5e-cutouts');
fs.mkdirSync(cutoutUploadDir, { recursive: true });
const uploadBatch = multer({ dest: uploadDir });

const normalizeSectionKey = (value = '') => String(value || '').trim().toLowerCase();
const normalizeTabKey = (value = '') => String(value || '').trim().toLowerCase();
const cleanIdentityPart = (value = '') => String(value || '').trim().toLowerCase();

function isNamedJpVuillet(firstName = '', lastName = '') {
    const safeFirstName = cleanIdentityPart(firstName);
    const safeLastName = cleanIdentityPart(lastName);
    return safeLastName === 'vuillet' && (safeFirstName === 'jp' || safeFirstName === 'jean');
}

function canManageWeb5eEntries(req) {
    const role = cleanIdentityPart(req.get('x-web5e-user-role'));
    const firstName = req.get('x-web5e-user-first-name');
    const lastName = req.get('x-web5e-user-last-name');
    if (isNamedJpVuillet(firstName, lastName)) return true;
    return role === 'teacher' || role === 'prof' || role === 'admin';
}

async function loadCutoutSource(imageUrl, req) {
    const source = String(imageUrl || '').trim();
    const dataMatch = source.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
    if (dataMatch) return { buffer: Buffer.from(dataMatch[2], 'base64'), mimeType: dataMatch[1] };

    if (source.startsWith('/uploads/')) {
        const publicRoot = path.resolve(process.cwd(), 'public');
        const localPath = path.resolve(publicRoot, source.replace(/^\/+/, ''));
        if (!localPath.startsWith(`${publicRoot}${path.sep}`) || !fs.existsSync(localPath)) {
            throw new Error('Image locale introuvable.');
        }
        return { buffer: fs.readFileSync(localPath), mimeType: 'image/png' };
    }

    const absoluteUrl = source.startsWith('/')
        ? `${req.protocol}://${req.get('host')}${source}`
        : source;
    if (!/^https?:\/\//i.test(absoluteUrl)) throw new Error('Format d’image non pris en charge.');
    const response = await fetchNode(absoluteUrl);
    if (!response.ok) throw new Error(`Image source inaccessible (${response.status}).`);
    return {
        buffer: await response.buffer(),
        mimeType: String(response.headers.get('content-type') || 'image/png').split(';')[0]
    };
}

router.post('/remove-background', async (req, res) => {
    try {
        const apiKey = String(process.env.REMOVE_BG_API_KEY || '').trim();
        if (!apiKey) return res.status(503).json({ ok: false, error: 'REMOVE_BG_API_KEY manquante côté serveur.' });
        const { buffer, mimeType } = await loadCutoutSource(req.body?.imageUrl, req);
        if (!buffer.length) return res.status(400).json({ ok: false, error: 'Image vide.' });
        if (buffer.length > 12 * 1024 * 1024) return res.status(413).json({ ok: false, error: 'Image trop volumineuse (12 Mo maximum).' });

        const cacheKey = crypto.createHash('sha256').update(buffer).digest('hex');
        const filename = `${cacheKey}.png`;
        const outputPath = path.join(cutoutUploadDir, filename);
        const publicUrl = `/uploads/web5e-cutouts/${filename}`;
        if (fs.existsSync(outputPath)) return res.json({ ok: true, imageUrl: publicUrl, cached: true });

        const formData = new FormData();
        formData.append('size', 'auto');
        formData.append('image_file', buffer, { filename: 'sprite.png', contentType: mimeType });
        const response = await fetchNode('https://api.remove.bg/v1.0/removebg', {
            method: 'POST',
            headers: { ...formData.getHeaders(), 'X-Api-Key': apiKey },
            body: formData
        });
        if (!response.ok) {
            const details = await response.text().catch(() => '');
            return res.status(response.status).json({ ok: false, error: `Détourage IA impossible. ${details}`.slice(0, 800) });
        }
        fs.writeFileSync(outputPath, await response.buffer());
        return res.json({ ok: true, imageUrl: publicUrl, cached: false });
    } catch (e) {
        return res.status(500).json({ ok: false, error: e.message || 'Détourage IA impossible.' });
    }
});

router.post('/tts', async (req, res) => {
    try {
        const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
        if (!apiKey) return res.status(503).json({ ok: false, error: 'OPENAI_API_KEY manquante côté serveur.' });
        const text = String(req.body?.text || '').trim();
        const character = String(req.body?.character || '').trim();
        const allowedVoices = new Set(['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse']);
        const voice = allowedVoices.has(String(req.body?.voice || '')) ? String(req.body.voice) : 'onyx';
        if (!text) return res.status(400).json({ ok: false, error: 'Le texte à prononcer est vide.' });
        if (text.length > 4000) return res.status(400).json({ ok: false, error: 'Le texte est trop long (4000 caractères maximum).' });
        const instructions = [
            'Parle en français naturel et fluide. Évite absolument un ton robotique.',
            character ? `Interprète ce personnage : ${character}` : '',
            'Respecte le sens du texte, articule clairement et joue le personnage sans caricature excessive.'
        ].filter(Boolean).join(' ');
        const cacheKey = crypto.createHash('sha256').update(JSON.stringify({ text, character, voice })).digest('hex');
        const filename = `${cacheKey}.mp3`;
        const outputPath = path.join(ttsUploadDir, filename);
        const publicUrl = `/uploads/web5e-tts/${filename}`;
        if (fs.existsSync(outputPath)) return res.json({ ok: true, audioUrl: publicUrl, cached: true });

        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini-tts',
                voice,
                input: text,
                instructions,
                response_format: 'mp3'
            })
        });
        if (!response.ok) {
            const details = await response.text().catch(() => '');
            return res.status(response.status).json({ ok: false, error: `Génération vocale impossible. ${details}`.slice(0, 800) });
        }
        const audioBuffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(outputPath, audioBuffer);
        return res.json({ ok: true, audioUrl: publicUrl, cached: false });
    } catch (e) {
        return res.status(500).json({ ok: false, error: e.message });
    }
});

function finalizeUpload(file) {
    const ext = path.extname(file.originalname || '') || '.jpg';
    const finalName = `${file.filename}${ext}`;
    const finalPath = path.join(uploadDir, finalName);
    fs.renameSync(file.path, finalPath);
    return `/uploads/web5e-mobile/${finalName}`;
}

async function readMobileTokenDoc(token = '') {
    const safeToken = String(token || '').trim();
    if (!safeToken) return null;
    return Web5eMobileActionAccess.findOne({ token: safeToken });
}

async function resolveMobileActionFromAccess(access) {
    const safeActionId = String(access?.actionId || '').trim();
    const safeScope = String(access?.scope || 'entry').trim();
    const safeEntryId = String(access?.entryId || '').trim();
    const safeBlockIndex = Number(access?.blockIndex || 0);
    if (!safeActionId) return null;

    if (safeScope === 'welcome') {
        const site = await ensureDefaultSite();
        const welcomeAnimation = site?.welcomeAnimation && typeof site.welcomeAnimation === 'object'
            ? site.welcomeAnimation
            : null;
        const actions = Array.isArray(welcomeAnimation?.actions) ? welcomeAnimation.actions : [];
        const action = actions.find((item) => String(item?.id || '') === safeActionId);
        if (!action) return null;
        return {
            site,
            entry: null,
            tab: null,
            blockIndex: 0,
            block: welcomeAnimation,
            action,
            isWelcome: true
        };
    }

    if (!safeEntryId || !mongoose.Types.ObjectId.isValid(safeEntryId)) return null;

    const site = await ensureDefaultSite();
    const entry = await Web5eEntry.findById(safeEntryId).lean();
    if (!entry) return null;
    const tab = entry?.tabId ? await Web5eTab.findById(entry.tabId).lean() : null;
    const blocks = Array.isArray(entry.blocks) ? entry.blocks : [];
    const block = blocks[safeBlockIndex] || null;
    const exactAction = Array.isArray(block?.actions)
        ? block.actions.find((item) => String(item?.id || '') === safeActionId)
        : null;

    if (block && exactAction) {
        return { site, entry, tab, blockIndex: safeBlockIndex, block, action: exactAction };
    }

    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
        const row = blocks[blockIndex];
        const action = Array.isArray(row?.actions)
            ? row.actions.find((item) => String(item?.id || '') === safeActionId)
            : null;
        if (action) {
            return { site, entry, tab, blockIndex, block: row, action };
        }
    }

    return null;
}

async function ensureDefaultSite() {
    let site = await Web5eSite.findOne({ slug: 'projet-5e' });
    if (!site) {
        site = await Web5eSite.create({
            slug: 'projet-5e',
            title: 'Projet 5e',
            subtitle: "L'eau et l'énergie"
        });
    }
    return site;
}

router.get('/public', async (_req, res) => {
    try {
        const site = await ensureDefaultSite();
        const [tabs, entries, actors, animations] = await Promise.all([
            Web5eTab.find({}).sort({ sectionKey: 1, order: 1, title: 1, updatedAt: -1 }).lean(),
            Web5eEntry.find({}).sort({ order: 1, updatedAt: -1, createdAt: -1 }).lean(),
            Web5eActor.find({}).sort({ updatedAt: -1 }).lean(),
            Web5eAnimation.find({}).sort({ updatedAt: -1 }).lean()
        ]);
        res.json({ ok: true, site, tabs, entries, actors, animations });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

router.get('/debug-counts', async (_req, res) => {
    try {
        const site = await ensureDefaultSite();
        const [
            siteCount,
            tabCount,
            entryCount,
            actorCount,
            animationCount,
            publishedTabCount,
            publishedEntryCount
        ] = await Promise.all([
            Web5eSite.countDocuments({}),
            Web5eTab.countDocuments({}),
            Web5eEntry.countDocuments({}),
            Web5eActor.countDocuments({}),
            Web5eAnimation.countDocuments({}),
            Web5eTab.countDocuments({ isPublished: true }),
            Web5eEntry.countDocuments({ isPublished: true })
        ]);

        const sampleTabs = await Web5eTab.find({})
            .sort({ updatedAt: -1, createdAt: -1 })
            .limit(5)
            .lean();
        const sampleEntries = await Web5eEntry.find({})
            .sort({ updatedAt: -1, createdAt: -1 })
            .limit(5)
            .lean();

        res.json({
            ok: true,
            mongo: {
                readyState: mongoose.connection.readyState,
                dbName: mongoose.connection?.db?.databaseName || '',
                host: mongoose.connection?.host || '',
                port: mongoose.connection?.port || null
            },
            site: {
                id: String(site?._id || ''),
                slug: String(site?.slug || ''),
                title: String(site?.title || '')
            },
            counts: {
                siteCount,
                tabCount,
                entryCount,
                actorCount,
                animationCount,
                publishedTabCount,
                publishedEntryCount
            },
            sampleTabs: sampleTabs.map((tab) => ({
                id: String(tab?._id || ''),
                siteId: String(tab?.siteId || ''),
                sectionKey: String(tab?.sectionKey || ''),
                tabKey: String(tab?.tabKey || ''),
                title: String(tab?.title || ''),
                isPublished: tab?.isPublished === true
            })),
            sampleEntries: sampleEntries.map((entry) => ({
                id: String(entry?._id || ''),
                siteId: String(entry?.siteId || ''),
                tabId: String(entry?.tabId || ''),
                authorName: String(entry?.authorName || ''),
                title: String(entry?.title || ''),
                isPublished: entry?.isPublished === true,
                blockTypes: Array.isArray(entry?.blocks) ? entry.blocks.map((block) => block?.type || '') : []
            }))
        });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

router.post('/site', async (req, res) => {
    try {
        const site = await ensureDefaultSite();
        const payload = {
            title: String(req.body?.title || site.title || '').trim() || 'Projet 5e',
            subtitle: String(req.body?.subtitle || site.subtitle || '').trim(),
            isPublic: req.body?.isPublic !== false,
            welcomeAnimation: req.body?.welcomeAnimation && typeof req.body.welcomeAnimation === 'object' ? req.body.welcomeAnimation : null,
            voteBoard: req.body?.voteBoard && typeof req.body.voteBoard === 'object' ? req.body.voteBoard : site.voteBoard || null,
            sectionOrder: Array.isArray(req.body?.sectionOrder) ? req.body.sectionOrder.map(normalizeSectionKey).filter(Boolean) : site.sectionOrder
        };
        const updated = await Web5eSite.findByIdAndUpdate(site._id, { $set: payload }, { new: true }).lean();
        res.json({ ok: true, site: updated });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

router.post('/votes', async (req, res) => {
    try {
        const site = await ensureDefaultSite();
        const voteBoard = req.body?.voteBoard && typeof req.body.voteBoard === 'object' ? req.body.voteBoard : null;
        if (!voteBoard) return res.status(400).json({ ok: false, error: 'voteBoard requis' });
        const updated = await Web5eSite.findByIdAndUpdate(site._id, { $set: { voteBoard } }, { new: true }).lean();
        res.json({ ok: true, voteBoard: updated.voteBoard || null, site: updated });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

router.post('/mobile-action-access', async (req, res) => {
    try {
        const site = await ensureDefaultSite();
        const actionId = String(req.body?.actionId || '').trim();
        const entryId = String(req.body?.entryId || '').trim();
        const blockIndex = Number(req.body?.blockIndex || 0);
        const isWelcome = normalizeSectionKey(req.body?.sectionKey || '') === 'welcome';
        if (!actionId) return res.status(400).json({ ok: false, error: 'actionId requis' });
        let access = null;

        if (isWelcome) {
            access = await Web5eMobileActionAccess.findOne({ actionId, scope: 'welcome', siteId: site._id, blockIndex: 0 });
            if (!access) {
                access = await Web5eMobileActionAccess.create({
                    token: crypto.randomBytes(12).toString('hex'),
                    actionId,
                    actionName: String(req.body?.actionName || '').trim(),
                    scope: 'welcome',
                    siteId: site._id,
                    entryId: null,
                    tabId: null,
                    sectionKey: 'welcome',
                    tabKey: 'header',
                    blockIndex: 0,
                    lastIssuedAt: new Date()
                });
            } else {
                access.siteId = site._id;
                access.actionName = String(req.body?.actionName || access.actionName || '').trim();
                access.scope = 'welcome';
                access.sectionKey = 'welcome';
                access.tabKey = 'header';
                access.blockIndex = 0;
                access.lastIssuedAt = new Date();
                await access.save();
            }
            return res.json({ ok: true, token: access.token });
        }

        const entry = entryId && mongoose.Types.ObjectId.isValid(entryId)
            ? await Web5eEntry.findById(entryId).lean()
            : null;
        access = await Web5eMobileActionAccess.findOne({ actionId, entryId, blockIndex, scope: 'entry' });
        if (!access) {
            access = await Web5eMobileActionAccess.create({
                token: crypto.randomBytes(12).toString('hex'),
                actionId,
                actionName: String(req.body?.actionName || '').trim(),
                scope: 'entry',
                siteId: site._id,
                entryId: entry?._id || null,
                tabId: mongoose.Types.ObjectId.isValid(String(req.body?.tabId || '')) ? req.body.tabId : entry?.tabId || null,
                sectionKey: normalizeSectionKey(req.body?.sectionKey || ''),
                tabKey: normalizeTabKey(req.body?.tabKey || ''),
                blockIndex,
                lastIssuedAt: new Date()
            });
        } else {
            access.scope = 'entry';
            access.siteId = site._id;
            access.actionName = String(req.body?.actionName || access.actionName || '').trim();
            access.entryId = entry?._id || access.entryId || null;
            access.tabId = mongoose.Types.ObjectId.isValid(String(req.body?.tabId || '')) ? req.body.tabId : entry?.tabId || access.tabId;
            access.sectionKey = normalizeSectionKey(req.body?.sectionKey || access.sectionKey || '');
            access.tabKey = normalizeTabKey(req.body?.tabKey || access.tabKey || '');
            access.blockIndex = blockIndex;
            access.lastIssuedAt = new Date();
            await access.save();
        }
        res.json({ ok: true, token: access.token });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

router.get('/mobile-action-session/:token', async (req, res) => {
    try {
        const access = await readMobileTokenDoc(req.params.token);
        if (!access?.actionId) return res.status(400).json({ ok: false, error: 'Token invalide' });
        const resolved = await resolveMobileActionFromAccess(access);
        res.json({
            ok: true,
            actionId: String(access.actionId || resolved?.action?.id || ''),
            actionName: String(resolved?.action?.name || access.actionName || 'Action'),
            blockIndex: Number(resolved?.blockIndex ?? access.blockIndex ?? 0),
            entryId: resolved?.entry?._id ? String(resolved.entry._id) : String(access.entryId || ''),
            tabId: String(resolved?.tab?._id || access.tabId || ''),
            sectionKey: String(resolved?.tab?.sectionKey || access.sectionKey || ''),
            tabKey: String(resolved?.tab?.tabKey || access.tabKey || ''),
            blocks: resolved ? (resolved.isWelcome ? [resolved.block] : (resolved.entry.blocks || [])) : [],
            pendingSoundUrl: String(access.pendingSoundUrl || ''),
            pendingFrames: Array.isArray(access.pendingFrames) ? access.pendingFrames : [],
            resolved: Boolean(resolved)
        });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

router.post('/mobile-action-audio/:token', async (req, res) => {
    try {
        const access = await readMobileTokenDoc(req.params.token);
        if (!access?.actionId) return res.status(400).json({ ok: false, error: 'Token invalide' });
        const resolved = await resolveMobileActionFromAccess(access);
        const soundUrl = String(req.body?.soundUrl || '').trim();
        if (!soundUrl) return res.status(400).json({ ok: false, error: 'soundUrl requis' });
        access.pendingSoundUrl = soundUrl;
        await access.save();
        if (!resolved) return res.json({ ok: true, pending: true });
        const doc = resolved.entry?._id ? await Web5eEntry.findById(resolved.entry._id) : null;
        if (resolved.isWelcome) {
            const site = await ensureDefaultSite();
            const welcomeAnimation = site?.welcomeAnimation && typeof site.welcomeAnimation === 'object' ? site.welcomeAnimation : null;
            if (!welcomeAnimation) return res.status(404).json({ ok: false, error: 'Animation welcome introuvable' });
            site.welcomeAnimation = {
                ...welcomeAnimation,
                actions: (welcomeAnimation.actions || []).map((action) => (
                    String(action?.id || '') === access.actionId ? { ...action, soundUrl } : action
                ))
            };
            await site.save();
        } else {
            if (!doc) return res.status(404).json({ ok: false, error: 'Entree introuvable' });
            doc.blocks = (doc.blocks || []).map((block, index) => (
                index === resolved.blockIndex
                    ? {
                        ...block,
                        actions: (block.actions || []).map((action) => (
                            String(action?.id || '') === access.actionId ? { ...action, soundUrl } : action
                        ))
                    }
                    : block
            ));
            await doc.save();
        }
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

router.post('/mobile-action-upload/:token', uploadBatch.array('files', 8), async (req, res) => {
    try {
        const access = await readMobileTokenDoc(req.params.token);
        if (!access?.actionId) return res.status(400).json({ ok: false, error: 'Token invalide' });
        const resolved = await resolveMobileActionFromAccess(access);
        const files = Array.isArray(req.files) ? req.files : [];
        if (!files.length) return res.status(400).json({ ok: false, error: 'Aucune photo envoyee' });
        const urls = files.map(finalizeUpload);
        access.pendingFrames = [
            ...(Array.isArray(access.pendingFrames) ? access.pendingFrames : []),
            ...urls.map((url) => ({ id: `frame_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, url, width: 140, height: 140, scale: 1, offsetX: 0, offsetY: 0 }))
        ];
        await access.save();
        if (!resolved) return res.json({ ok: true, pending: true });
        if (resolved.isWelcome) {
            const site = await ensureDefaultSite();
            const welcomeAnimation = site?.welcomeAnimation && typeof site.welcomeAnimation === 'object' ? site.welcomeAnimation : null;
            if (!welcomeAnimation) return res.status(404).json({ ok: false, error: 'Animation welcome introuvable' });
            site.welcomeAnimation = {
                ...welcomeAnimation,
                actions: (welcomeAnimation.actions || []).map((action) => (
                    String(action?.id || '') === access.actionId
                        ? {
                            ...action,
                            frames: [...(Array.isArray(action.frames) ? action.frames : []), ...urls.map((url) => ({ id: `frame_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, url, width: 140, height: 140, scale: 1, offsetX: 0, offsetY: 0 }))]
                        }
                        : action
                ))
            };
            await site.save();
        } else {
            const doc = await Web5eEntry.findById(resolved.entry._id);
            if (!doc) return res.status(404).json({ ok: false, error: 'Entree introuvable' });
            doc.blocks = (doc.blocks || []).map((block, index) => (
                index === resolved.blockIndex
                    ? {
                        ...block,
                        actions: (block.actions || []).map((action) => (
                            String(action?.id || '') === access.actionId
                                ? {
                                    ...action,
                                    frames: [...(Array.isArray(action.frames) ? action.frames : []), ...urls.map((url) => ({ id: `frame_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, url, width: 140, height: 140, scale: 1, offsetX: 0, offsetY: 0 }))]
                                  }
                                : action
                        ))
                    }
                    : block
            ));
            await doc.save();
        }
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

router.post('/mobile-action-consume/:token', async (req, res) => {
    try {
        const access = await readMobileTokenDoc(req.params.token);
        if (!access) return res.status(404).json({ ok: false, error: 'Token introuvable' });
        access.pendingSoundUrl = '';
        access.pendingFrames = [];
        await access.save();
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

router.post('/tabs', async (req, res) => {
    try {
        const site = await ensureDefaultSite();
        const data = { ...req.body };
        if (!data._id || data._id === 'null') delete data._id;
        const payload = {
            siteId: site._id,
            sectionKey: normalizeSectionKey(data.sectionKey),
            tabKey: normalizeTabKey(data.tabKey || data.title),
            title: String(data.title || '').trim(),
            description: String(data.description || '').trim(),
            order: Number(data.order || 0),
            isPublished: data.isPublished !== false,
            createdBy: mongoose.Types.ObjectId.isValid(String(data.createdBy || '')) ? data.createdBy : null,
            createdByModel: ['Teacher', 'Admin', 'Student'].includes(String(data.createdByModel || '')) ? data.createdByModel : 'Teacher'
        };
        if (!payload.sectionKey || !payload.title) {
            return res.status(400).json({ ok: false, error: 'sectionKey et title requis' });
        }
        const row = data._id
            ? await Web5eTab.findByIdAndUpdate(data._id, { $set: payload }, { new: true })
            : await Web5eTab.create(payload);
        res.json({ ok: true, tab: row });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

router.post('/entries', async (req, res) => {
    try {
        const site = await ensureDefaultSite();
        const data = { ...req.body };
        if (!data._id || data._id === 'null' || !mongoose.Types.ObjectId.isValid(String(data._id || ''))) delete data._id;
        const safeAuthorName = String(data.authorName || '').trim();
        const payload = {
            siteId: site._id,
            tabId: data.tabId,
            studentId: mongoose.Types.ObjectId.isValid(String(data.studentId || '')) ? data.studentId : null,
            authorName: safeAuthorName,
            title: String(data.title || '').trim(),
            blocks: Array.isArray(data.blocks) ? data.blocks : [],
            order: Number(data.order || 0),
            isPublished: data.isPublished !== false,
            teacherValidated: data.teacherValidated === true
        };
        if (!mongoose.Types.ObjectId.isValid(String(payload.tabId || ''))) {
            return res.status(400).json({ ok: false, error: 'tabId requis' });
        }
        let row = null;
        if (data._id) {
            row = await Web5eEntry.findByIdAndUpdate(data._id, { $set: payload }, { new: true });
        } else if (payload.studentId) {
            row = await Web5eEntry.findOneAndUpdate(
                {
                    siteId: site._id,
                    tabId: payload.tabId,
                    studentId: payload.studentId
                },
                { $set: payload },
                { new: true }
            );
            if (!row) {
                row = await Web5eEntry.create(payload);
            }
        } else if (safeAuthorName) {
            row = await Web5eEntry.findOneAndUpdate(
                {
                    siteId: site._id,
                    tabId: payload.tabId,
                    authorName: safeAuthorName
                },
                { $set: payload },
                { new: true }
            );
            if (!row) {
                row = await Web5eEntry.create(payload);
            }
        } else {
            row = await Web5eEntry.create(payload);
        }
        res.json({ ok: true, entry: row });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

router.delete('/entries/:id', async (req, res) => {
    try {
        if (!canManageWeb5eEntries(req)) {
            return res.status(403).json({ ok: false, error: 'suppression reservee au professeur' });
        }
        const entryId = String(req.params?.id || '').trim();
        if (!mongoose.Types.ObjectId.isValid(entryId)) {
            return res.status(400).json({ ok: false, error: 'entry id invalide' });
        }
        const deleted = await Web5eEntry.findByIdAndDelete(entryId).lean();
        if (!deleted) {
            return res.status(404).json({ ok: false, error: 'entree introuvable' });
        }
        res.json({ ok: true, deletedId: entryId });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

router.post('/actors', async (req, res) => {
    try {
        const site = await ensureDefaultSite();
        const data = { ...req.body };
        if (!data._id || data._id === 'null') delete data._id;
        const payload = {
            siteId: site._id,
            studentId: mongoose.Types.ObjectId.isValid(String(data.studentId || '')) ? data.studentId : null,
            name: String(data.name || '').trim() || 'Personnage',
            imageUrl: String(data.imageUrl || '').trim(),
            initialX: Number(data.initialX || 50),
            initialY: Number(data.initialY || 50),
            scale: Number(data.scale || 1),
            hiddenByDefault: data.hiddenByDefault === true,
            actions: Array.isArray(data.actions) ? data.actions : []
        };
        const row = data._id
            ? await Web5eActor.findByIdAndUpdate(data._id, { $set: payload }, { new: true })
            : await Web5eActor.create(payload);
        res.json({ ok: true, actor: row });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

router.post('/animations', async (req, res) => {
    try {
        const site = await ensureDefaultSite();
        const data = { ...req.body };
        if (!data._id || data._id === 'null') delete data._id;
        const payload = {
            siteId: site._id,
            tabId: data.tabId,
            studentId: mongoose.Types.ObjectId.isValid(String(data.studentId || '')) ? data.studentId : null,
            name: String(data.name || '').trim() || 'Animation',
            blocks: Array.isArray(data.blocks) ? data.blocks : [],
            isPublished: data.isPublished !== false
        };
        if (!mongoose.Types.ObjectId.isValid(String(payload.tabId || ''))) {
            return res.status(400).json({ ok: false, error: 'tabId requis' });
        }
        const row = data._id
            ? await Web5eAnimation.findByIdAndUpdate(data._id, { $set: payload }, { new: true })
            : await Web5eAnimation.create(payload);
        res.json({ ok: true, animation: row });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

router.post('/audio', async (req, res) => {
    try {
        const site = await ensureDefaultSite();
        const data = { ...req.body };
        if (!data._id || data._id === 'null') delete data._id;
        const payload = {
            siteId: site._id,
            studentId: mongoose.Types.ObjectId.isValid(String(data.studentId || '')) ? data.studentId : null,
            tabId: mongoose.Types.ObjectId.isValid(String(data.tabId || '')) ? data.tabId : null,
            name: String(data.name || '').trim() || 'Son',
            audioUrl: String(data.audioUrl || '').trim(),
            durationSec: Number(data.durationSec || 0),
            modulation: {
                volume: Number(data?.modulation?.volume ?? 1),
                rate: Number(data?.modulation?.rate ?? 1),
                pitch: Number(data?.modulation?.pitch ?? 1)
            }
        };
        const row = data._id
            ? await Web5eAudio.findByIdAndUpdate(data._id, { $set: payload }, { new: true })
            : await Web5eAudio.create(payload);
        res.json({ ok: true, audio: row });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

module.exports = router;
