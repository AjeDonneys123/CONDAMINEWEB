const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const {
    Web5eSite,
    Web5eTab,
    Web5eEntry,
    Web5eActor,
    Web5eAnimation,
    Web5eAudio
} = require('./models.web5e');

const router = express.Router();
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'web5e-mobile');
fs.mkdirSync(uploadDir, { recursive: true });
const uploadBatch = multer({ dest: uploadDir });

const normalizeSectionKey = (value = '') => String(value || '').trim().toLowerCase();
const normalizeTabKey = (value = '') => String(value || '').trim().toLowerCase();
const MOBILE_SECRET = String(process.env.WEB5E_MOBILE_SECRET || 'web5e-mobile-secret');

function finalizeUpload(file) {
    const ext = path.extname(file.originalname || '') || '.jpg';
    const finalName = `${file.filename}${ext}`;
    const finalPath = path.join(uploadDir, finalName);
    fs.renameSync(file.path, finalPath);
    return `/uploads/web5e-mobile/${finalName}`;
}

function signMobilePayload(payload) {
    const json = JSON.stringify(payload);
    const body = Buffer.from(json).toString('base64url');
    const sig = crypto.createHmac('sha256', MOBILE_SECRET).update(body).digest('hex');
    return `${body}.${sig}`;
}

function verifyMobileToken(token = '') {
    const raw = String(token || '').trim();
    const [body, sig] = raw.split('.');
    if (!body || !sig) return null;
    const expected = crypto.createHmac('sha256', MOBILE_SECRET).update(body).digest('hex');
    if (expected !== sig) return null;
    try {
        return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch (_) {
        return null;
    }
}

async function resolveMobileAction(actionId = '') {
    const site = await ensureDefaultSite();
    const entries = await Web5eEntry.find({ siteId: site._id, isPublished: true }).lean();
    for (const entry of entries) {
        const blocks = Array.isArray(entry.blocks) ? entry.blocks : [];
        for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
            const block = blocks[blockIndex];
            const actions = Array.isArray(block?.actions) ? block.actions : [];
            const action = actions.find((item) => String(item?.id || '') === String(actionId || '').trim());
            if (action) {
                const tab = await Web5eTab.findById(entry.tabId).lean();
                return { site, entry, tab, blockIndex, block, action };
            }
        }
    }
    return null;
}

async function resolveMobileActionFromPayload(payload = {}) {
    const safeActionId = String(payload?.actionId || '').trim();
    const safeEntryId = String(payload?.entryId || '').trim();
    const safeTabId = String(payload?.tabId || '').trim();
    const safeBlockIndex = Number(payload?.blockIndex);
    const safeSectionKey = normalizeSectionKey(payload?.sectionKey || '');
    const safeTabKey = normalizeTabKey(payload?.tabKey || '');

    if (safeActionId) {
        const direct = await resolveMobileAction(safeActionId);
        if (direct) return direct;
    }

    const site = await ensureDefaultSite();
    let entry = null;
    let tab = null;

    if (safeEntryId && mongoose.Types.ObjectId.isValid(safeEntryId)) {
        entry = await Web5eEntry.findById(safeEntryId).lean();
        if (entry?.tabId) tab = await Web5eTab.findById(entry.tabId).lean();
    }

    if (!entry && safeTabId && mongoose.Types.ObjectId.isValid(safeTabId)) {
        tab = await Web5eTab.findById(safeTabId).lean();
        entry = await Web5eEntry.findOne({ tabId: safeTabId }).sort({ updatedAt: -1 }).lean();
    }

    if (!entry && safeSectionKey && safeTabKey) {
        tab = await Web5eTab.findOne({ siteId: site._id, sectionKey: safeSectionKey, tabKey: safeTabKey }).lean();
        if (tab?._id) entry = await Web5eEntry.findOne({ tabId: tab._id }).sort({ updatedAt: -1 }).lean();
    }

    if (!entry) return null;
    if (!tab && entry?.tabId) tab = await Web5eTab.findById(entry.tabId).lean();

    const blocks = Array.isArray(entry.blocks) ? entry.blocks : [];
    const indexedCandidates = Number.isFinite(safeBlockIndex) ? [safeBlockIndex] : [];
    const candidateIndexes = [...indexedCandidates, ...blocks.map((_, index) => index).filter((index) => !indexedCandidates.includes(index))];

    for (const blockIndex of candidateIndexes) {
        const block = blocks[blockIndex];
        const actions = Array.isArray(block?.actions) ? block.actions : [];
        const action = actions.find((item) => String(item?.id || '') === safeActionId) || actions[0];
        if (action) {
            return { site, entry, tab, blockIndex, block, action };
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
            Web5eTab.find({ siteId: site._id, isPublished: true }).sort({ sectionKey: 1, order: 1, title: 1 }).lean(),
            Web5eEntry.find({ siteId: site._id, isPublished: true }).sort({ order: 1, updatedAt: -1 }).lean(),
            Web5eActor.find({ siteId: site._id }).sort({ updatedAt: -1 }).lean(),
            Web5eAnimation.find({ siteId: site._id, isPublished: true }).sort({ updatedAt: -1 }).lean()
        ]);
        res.json({ ok: true, site, tabs, entries, actors, animations });
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
            sectionOrder: Array.isArray(req.body?.sectionOrder) ? req.body.sectionOrder.map(normalizeSectionKey).filter(Boolean) : site.sectionOrder
        };
        const updated = await Web5eSite.findByIdAndUpdate(site._id, { $set: payload }, { new: true }).lean();
        res.json({ ok: true, site: updated });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

router.post('/mobile-action-access', async (req, res) => {
    try {
        const actionId = String(req.body?.actionId || '').trim();
        if (!actionId) return res.status(400).json({ ok: false, error: 'actionId requis' });
        const token = signMobilePayload({
            actionId,
            entryId: String(req.body?.entryId || '').trim(),
            tabId: String(req.body?.tabId || '').trim(),
            sectionKey: normalizeSectionKey(req.body?.sectionKey || ''),
            tabKey: normalizeTabKey(req.body?.tabKey || ''),
            blockIndex: Number(req.body?.blockIndex || 0),
            issuedAt: Date.now()
        });
        res.json({ ok: true, token });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

router.get('/mobile-action-session/:token', async (req, res) => {
    try {
        const payload = verifyMobileToken(req.params.token);
        if (!payload?.actionId) return res.status(400).json({ ok: false, error: 'Token invalide' });
        const resolved = await resolveMobileActionFromPayload(payload);
        if (!resolved) return res.status(404).json({ ok: false, error: 'Action introuvable' });
        res.json({
            ok: true,
            actionId: String(resolved.action.id || ''),
            blockIndex: Number(resolved.blockIndex),
            entryId: String(resolved.entry._id),
            tabId: String(resolved.tab?._id || ''),
            sectionKey: String(resolved.tab?.sectionKey || ''),
            tabKey: String(resolved.tab?.tabKey || ''),
            blocks: resolved.entry.blocks || []
        });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

router.post('/mobile-action-audio/:token', async (req, res) => {
    try {
        const payload = verifyMobileToken(req.params.token);
        if (!payload?.actionId) return res.status(400).json({ ok: false, error: 'Token invalide' });
        const resolved = await resolveMobileActionFromPayload(payload);
        if (!resolved) return res.status(404).json({ ok: false, error: 'Action introuvable' });
        const soundUrl = String(req.body?.soundUrl || '').trim();
        if (!soundUrl) return res.status(400).json({ ok: false, error: 'soundUrl requis' });
        const doc = await Web5eEntry.findById(resolved.entry._id);
        if (!doc) return res.status(404).json({ ok: false, error: 'Entree introuvable' });
        doc.blocks = (doc.blocks || []).map((block, index) => (
            index === resolved.blockIndex
                ? {
                    ...block,
                    actions: (block.actions || []).map((action) => (
                        String(action?.id || '') === payload.actionId ? { ...action, soundUrl } : action
                    ))
                }
                : block
        ));
        await doc.save();
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

router.post('/mobile-action-upload/:token', uploadBatch.array('files', 8), async (req, res) => {
    try {
        const payload = verifyMobileToken(req.params.token);
        if (!payload?.actionId) return res.status(400).json({ ok: false, error: 'Token invalide' });
        const resolved = await resolveMobileActionFromPayload(payload);
        if (!resolved) return res.status(404).json({ ok: false, error: 'Action introuvable' });
        const files = Array.isArray(req.files) ? req.files : [];
        if (!files.length) return res.status(400).json({ ok: false, error: 'Aucune photo envoyee' });
        const urls = files.map(finalizeUpload);
        const doc = await Web5eEntry.findById(resolved.entry._id);
        if (!doc) return res.status(404).json({ ok: false, error: 'Entree introuvable' });
        doc.blocks = (doc.blocks || []).map((block, index) => (
            index === resolved.blockIndex
                ? {
                    ...block,
                    actions: (block.actions || []).map((action) => (
                        String(action?.id || '') === payload.actionId
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
        if (!data._id || data._id === 'null') delete data._id;
        const payload = {
            siteId: site._id,
            tabId: data.tabId,
            studentId: mongoose.Types.ObjectId.isValid(String(data.studentId || '')) ? data.studentId : null,
            authorName: String(data.authorName || '').trim(),
            title: String(data.title || '').trim(),
            blocks: Array.isArray(data.blocks) ? data.blocks : [],
            order: Number(data.order || 0),
            isPublished: data.isPublished !== false,
            teacherValidated: data.teacherValidated === true
        };
        if (!mongoose.Types.ObjectId.isValid(String(payload.tabId || ''))) {
            return res.status(400).json({ ok: false, error: 'tabId requis' });
        }
        const row = data._id
            ? await Web5eEntry.findByIdAndUpdate(data._id, { $set: payload }, { new: true })
            : await Web5eEntry.create(payload);
        res.json({ ok: true, entry: row });
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
