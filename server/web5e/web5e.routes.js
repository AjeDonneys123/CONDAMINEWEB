const express = require('express');
const mongoose = require('mongoose');
const {
    Web5eSite,
    Web5eTab,
    Web5eEntry,
    Web5eActor,
    Web5eAnimation,
    Web5eAudio
} = require('./models.web5e');

const router = express.Router();

const normalizeSectionKey = (value = '') => String(value || '').trim().toLowerCase();
const normalizeTabKey = (value = '') => String(value || '').trim().toLowerCase();

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
