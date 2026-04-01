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
    Web5eAudio,
    Web5eMobileActionAccess
} = require('./models.web5e');

const router = express.Router();
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'web5e-mobile');
fs.mkdirSync(uploadDir, { recursive: true });
const uploadBatch = multer({ dest: uploadDir });

const normalizeSectionKey = (value = '') => String(value || '').trim().toLowerCase();
const normalizeTabKey = (value = '') => String(value || '').trim().toLowerCase();
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
    const safeEntryId = String(access?.entryId || '').trim();
    const safeBlockIndex = Number(access?.blockIndex || 0);
    if (!safeActionId || !safeEntryId || !mongoose.Types.ObjectId.isValid(safeEntryId)) return null;

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
        const entryId = String(req.body?.entryId || '').trim();
        const blockIndex = Number(req.body?.blockIndex || 0);
        if (!actionId) return res.status(400).json({ ok: false, error: 'actionId requis' });
        if (!entryId || !mongoose.Types.ObjectId.isValid(entryId)) {
            return res.status(400).json({ ok: false, error: 'entryId requis' });
        }
        const entry = await Web5eEntry.findById(entryId).lean();
        if (!entry) return res.status(404).json({ ok: false, error: 'Entree introuvable' });
        const blocks = Array.isArray(entry.blocks) ? entry.blocks : [];
        const block = blocks[blockIndex] || null;
        const hasActionInEntry = blocks.some((row) => Array.isArray(row?.actions) && row.actions.some((item) => String(item?.id || '') === actionId));
        if (!hasActionInEntry) return res.status(404).json({ ok: false, error: 'Action introuvable' });
        let access = await Web5eMobileActionAccess.findOne({ actionId, entryId, blockIndex });
        if (!access) {
            access = await Web5eMobileActionAccess.create({
                token: crypto.randomBytes(12).toString('hex'),
                actionId,
                entryId,
                tabId: mongoose.Types.ObjectId.isValid(String(req.body?.tabId || '')) ? req.body.tabId : entry?.tabId || null,
                sectionKey: normalizeSectionKey(req.body?.sectionKey || ''),
                tabKey: normalizeTabKey(req.body?.tabKey || ''),
                blockIndex,
                lastIssuedAt: new Date()
            });
        } else {
            access.entryId = entryId;
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
        const access = await readMobileTokenDoc(req.params.token);
        if (!access?.actionId) return res.status(400).json({ ok: false, error: 'Token invalide' });
        const resolved = await resolveMobileActionFromAccess(access);
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
                        String(action?.id || '') === access.actionId ? { ...action, soundUrl } : action
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
        const access = await readMobileTokenDoc(req.params.token);
        if (!access?.actionId) return res.status(400).json({ ok: false, error: 'Token invalide' });
        const resolved = await resolveMobileActionFromAccess(access);
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
