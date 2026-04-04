const express = require('express');
const router = express.Router();
const { Expose } = require('../models/prof.models');
const { Web5eEntry } = require('../../web5e/models.web5e');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const ProfDrive = require('../core/drive.prof');

const upload = multer({ dest: path.join(process.cwd(), 'public', 'uploads', 'temp') });

const clean = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

function createDefaultAnimationBlock(soundUrl = '', soundPitch = 1) {
    return {
        type: 'animation',
        title: 'Animation importee',
        actorName: 'Personnage',
        actorImageUrl: '',
        actorX: 120,
        actorY: 120,
        actorWidth: 140,
        actorHeight: 140,
        savedActions: [],
        actions: [{
            id: `action_${Date.now()}`,
            name: 'Parler',
            frames: [],
            frameUrlInput: '',
            soundUrl: String(soundUrl || '').trim(),
            soundPitch: Math.max(0.5, Math.min(2, Number(soundPitch || 1))),
            spritesOpen: false,
            spriteUrlOpen: false,
            spriteEditorOpen: false,
            selectedFrameIndex: 0
        }]
    };
}

async function injectPresenterAudioIntoWeb5e({ presentationTitle = '', presenterName = '', slideNumber = 0, soundUrl = '', soundPitch = 1 }) {
    const safeTitle = clean(presentationTitle);
    const safePresenter = clean(presenterName);
    const safeSlideNumber = Math.max(1, Number(slideNumber || 0));
    const safeSoundUrl = String(soundUrl || '').trim();
    const safeSoundPitch = Math.max(0.5, Math.min(2, Number(soundPitch || 1)));
    if (!safeTitle || !safePresenter || !safeSoundUrl || !safeSlideNumber) return { updated: false };

    const entries = await Web5eEntry.find({ isPublished: true });
    for (const entry of entries) {
        let touched = false;
        entry.blocks = (Array.isArray(entry.blocks) ? entry.blocks : []).map((block) => {
            const matchesPresentation = clean(block?.presentationName || block?.title || '') === safeTitle;
            if (!matchesPresentation) return block;
            const slides = Array.isArray(block?.slides) ? block.slides : [];
            if (!slides.length) return block;
            const nextSlides = slides.map((slide, index) => {
                const slideIdx = index + 1;
                const matchesPresenter = clean(slide?.presenterName || '') === safePresenter;
                const matchesSlideNumber = slideIdx === safeSlideNumber;
                if (!matchesPresenter || !matchesSlideNumber) return slide;
                touched = true;
                const currentAnimation = slide?.animation && typeof slide.animation === 'object'
                    ? slide.animation
                    : createDefaultAnimationBlock(safeSoundUrl, safeSoundPitch);
                const currentActions = Array.isArray(currentAnimation.actions) ? currentAnimation.actions : [];
                const parlerIndex = currentActions.findIndex((action) => clean(action?.name || '') === 'parler');
                const nextActions = parlerIndex >= 0
                    ? currentActions.map((action, actionIndex) => (
                        actionIndex === parlerIndex ? { ...action, soundUrl: safeSoundUrl, soundPitch: safeSoundPitch } : action
                    ))
                    : [{
                        id: `action_${Date.now()}`,
                        name: 'Parler',
                        frames: [],
                        frameUrlInput: '',
                        soundUrl: safeSoundUrl,
                        soundPitch: safeSoundPitch,
                        spritesOpen: false,
                        spriteUrlOpen: false,
                        spriteEditorOpen: false,
                        selectedFrameIndex: 0
                    }, ...currentActions];
                return {
                    ...slide,
                    animation: {
                        ...currentAnimation,
                        actions: nextActions
                    }
                };
            });
            return touched ? { ...block, slides: nextSlides } : block;
        });
        if (touched) {
            await entry.save();
            return { updated: true, entryId: String(entry._id || '') };
        }
    }
    return { updated: false };
}

router.get('/all', async (req, res) => {
    try {
        const rows = await Expose.find({}).sort({ date: -1 }).lean();
        res.json(rows);
    } catch (e) {
        res.status(500).json([]);
    }
});

router.get('/presenter-backup', async (req, res) => {
    try {
        const presenterName = String(req.query?.presenterName || '').trim();
        if (!presenterName) return res.status(400).json({ ok: false, error: 'presenterName requis' });

        const exposes = await Expose.find({}).sort({ date: -1 }).lean();
        for (const expose of exposes) {
            const presentations = Array.isArray(expose?.presentations) ? expose.presentations : [];
            const matches = presentations
                .filter((row) => (
                    clean(row?.presenterName || '') === clean(presenterName)
                    && (
                        String(row?.recordingUrl || '').trim()
                        || (Array.isArray(row?.spriteImageUrls) && row.spriteImageUrls.some((url) => String(url || '').trim()))
                    )
                ))
                .sort((a, b) => {
                    if (Boolean(a?.selectedForPresenter) !== Boolean(b?.selectedForPresenter)) {
                        return a?.selectedForPresenter ? -1 : 1;
                    }
                    return new Date(b?.updatedAt || b?.createdAt || 0).getTime() - new Date(a?.updatedAt || a?.createdAt || 0).getTime();
                });
            const match = matches[0];
            if (match) {
                return res.json({
                    ok: true,
                    recordingUrl: String(match.recordingUrl || '').trim(),
                    recordingPitch: Math.max(0.5, Math.min(2, Number(match.recordingPitch || 1))),
                    spriteImageUrls: Array.isArray(match?.spriteImageUrls)
                        ? match.spriteImageUrls.map((url) => String(url || '').trim()).filter(Boolean)
                        : [],
                    presentationTitle: String(match.presentationTitle || ''),
                    presenterName: String(match.presenterName || ''),
                    slideNumber: Math.max(1, Number(match.presenterSlideNumber || 1)),
                    recordings: matches.map((row) => ({
                        id: String(row?._id || ''),
                        recordingUrl: String(row?.recordingUrl || '').trim(),
                        recordingPitch: Math.max(0.5, Math.min(2, Number(row?.recordingPitch || 1))),
                        presentationTitle: String(row?.presentationTitle || ''),
                        presenterName: String(row?.presenterName || ''),
                        slideNumber: Math.max(1, Number(row?.presenterSlideNumber || 1)),
                        durationSec: Math.max(0, Number(row?.recordingDurationSec || 0)),
                        selected: row?.selectedForPresenter === true,
                        spriteImageUrls: Array.isArray(row?.spriteImageUrls)
                            ? row.spriteImageUrls.map((url) => String(url || '').trim()).filter(Boolean)
                            : []
                    }))
                });
            }
        }
        return res.status(404).json({ ok: false, error: 'Backup introuvable' });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const row = await Expose.findById(req.params.id).lean();
        if (!row) return res.status(404).json({ error: 'Exposé introuvable' });
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const data = { ...req.body };
        if (!data._id || data._id === 'null') delete data._id;
        if (typeof data.isEnabled !== 'boolean') data.isEnabled = true;
        data.targetClassrooms = [...new Set((data.targetClassrooms || [])
            .map((c) => String(c || '').trim().toUpperCase())
            .filter(Boolean))];
        const row = data._id
            ? await Expose.findByIdAndUpdate(data._id, data, { new: true })
            : await Expose.create(data);
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.patch('/:id/enabled', async (req, res) => {
    try {
        const isEnabled = req.body?.isEnabled !== false;
        const row = await Expose.findByIdAndUpdate(
            req.params.id,
            { $set: { isEnabled } },
            { new: true }
        ).lean();
        if (!row) return res.status(404).json({ error: 'Exposé introuvable' });
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await Expose.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:id/presentation-group', async (req, res) => {
    try {
        const exposeId = String(req.params.id || '').trim();
        const title = String(req.query?.title || '').trim();
        if (!exposeId) return res.status(400).json({ error: 'id requis' });
        if (!title) return res.status(400).json({ error: 'title requis' });

        const row = await Expose.findById(exposeId);
        if (!row) return res.status(404).json({ error: 'Exposé introuvable' });

        const before = Array.isArray(row.presentations) ? row.presentations.length : 0;
        row.presentations = (row.presentations || []).filter((p) => String(p?.presentationTitle || '').trim() !== title);
        const after = Array.isArray(row.presentations) ? row.presentations.length : 0;
        await row.save();

        res.json({ ok: true, removed: Math.max(0, before - after) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/:id/presenter-recording', upload.single('audio'), async (req, res) => {
    try {
        const exposeId = String(req.params.id || '').trim();
        const studentId = String(req.body?.studentId || '').trim();
        const presentationTitle = String(req.body?.presentationTitle || '').trim();
        const presenterName = String(req.body?.presenterName || '').trim();
        const slideNumber = Math.max(1, Number(req.body?.slideNumber || 0));
        const recordingDurationSec = Math.max(0, Number(req.body?.recordingDurationSec || 0));
        const recordingPitch = Math.max(0.5, Math.min(2, Number(req.body?.recordingPitch || 1)));

        if (!exposeId) return res.status(400).json({ error: 'id requis' });
        if (!studentId) return res.status(400).json({ error: 'studentId requis' });
        if (!presentationTitle) return res.status(400).json({ error: 'presentationTitle requis' });
        if (!presenterName) return res.status(400).json({ error: 'presenterName requis' });
        if (!slideNumber) return res.status(400).json({ error: 'slideNumber requis' });

        const row = await Expose.findById(exposeId);
        if (!row) return res.status(404).json({ error: 'Exposé introuvable' });

        let recordingUrl = '';
        let uploadWarning = '';
        if (req.file) {
            try {
                const folderId = await ProfDrive.getOrCreateFolder('CONDA_EXPOSES_AUDIO');
                const driveFile = await ProfDrive.uploadFile(req.file.originalname, req.file.path, folderId);
                recordingUrl = `/api/structure/proxy/${driveFile.id}`;
            } catch (uploadErr) {
                uploadWarning = `Audio non uploadé sur Drive: ${uploadErr.message}`;
            } finally {
                try { fs.unlinkSync(req.file.path); } catch (_) {}
            }
        }
        if (!recordingUrl) return res.status(400).json({ error: uploadWarning || 'audio requis' });

        const now = new Date();
        const entries = Array.isArray(row.presentations)
            ? row.presentations.map((entry) => (typeof entry?.toObject === 'function' ? entry.toObject() : { ...entry }))
            : [];
        const nextEntries = entries.map((entry) => {
            if (clean(entry?.presenterName || '') !== clean(presenterName)) return entry;
            return { ...entry, selectedForPresenter: false };
        });
        const nextEntry = {
            studentId,
            presentationTitle,
            canvasUrl: '',
            slidesText: '',
            recordingUrl,
            recordingDurationSec,
            recordingPitch,
            spriteImageUrls: [],
            presenterName,
            presenterSlideNumber: slideNumber,
            selectedForPresenter: true,
            createdAt: now,
            updatedAt: now
        };
        nextEntries.push(nextEntry);
        row.presentations = nextEntries;
        await row.save();

        const injection = await injectPresenterAudioIntoWeb5e({
            presentationTitle,
            presenterName,
            slideNumber,
            soundUrl: recordingUrl,
            soundPitch: recordingPitch
        });

        res.json({
            ok: true,
            presentation: row.presentations[row.presentations.length - 1],
            web5eLinked: Boolean(injection.updated),
            warning: uploadWarning || null
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/:id/presenter-images', upload.array('images'), async (req, res) => {
    try {
        const exposeId = String(req.params.id || '').trim();
        const studentId = String(req.body?.studentId || '').trim();
        const presentationTitle = String(req.body?.presentationTitle || '').trim();
        const presenterName = String(req.body?.presenterName || '').trim();
        const slideNumber = Math.max(1, Number(req.body?.slideNumber || 0));

        if (!exposeId) return res.status(400).json({ error: 'id requis' });
        if (!studentId) return res.status(400).json({ error: 'studentId requis' });
        if (!presentationTitle) return res.status(400).json({ error: 'presentationTitle requis' });
        if (!presenterName) return res.status(400).json({ error: 'presenterName requis' });
        if (!slideNumber) return res.status(400).json({ error: 'slideNumber requis' });

        const row = await Expose.findById(exposeId);
        if (!row) return res.status(404).json({ error: 'Exposé introuvable' });

        const files = Array.isArray(req.files) ? req.files : [];
        if (!files.length) return res.status(400).json({ error: 'image requise' });

        const folderId = await ProfDrive.getOrCreateFolder('CONDA_EXPOSES_IMAGES');
        const uploadedUrls = [];
        for (const file of files) {
            try {
                const driveFile = await ProfDrive.uploadFile(file.originalname, file.path, folderId);
                uploadedUrls.push(`/api/structure/proxy/${driveFile.id}`);
            } finally {
                try { fs.unlinkSync(file.path); } catch (_) {}
            }
        }
        if (!uploadedUrls.length) return res.status(400).json({ error: 'Aucune image uploadée' });

        const now = new Date();
        const entries = Array.isArray(row.presentations)
            ? row.presentations.map((entry) => (typeof entry?.toObject === 'function' ? entry.toObject() : { ...entry }))
            : [];
        const presenterKey = clean(presenterName);
        const existingIndex = entries.findIndex((entry) => (
            String(entry?.studentId || '') === studentId
            && clean(entry?.presenterName || '') === presenterKey
            && Math.max(1, Number(entry?.presenterSlideNumber || 1)) === slideNumber
        ));

        if (existingIndex >= 0) {
            const existingUrls = Array.isArray(entries[existingIndex]?.spriteImageUrls) ? entries[existingIndex].spriteImageUrls : [];
            entries[existingIndex] = {
                ...entries[existingIndex],
                presentationTitle: presentationTitle || String(entries[existingIndex]?.presentationTitle || ''),
                spriteImageUrls: [...existingUrls, ...uploadedUrls],
                updatedAt: now
            };
        } else {
            entries.push({
                studentId,
                presentationTitle,
                canvasUrl: '',
                slidesText: '',
                recordingUrl: '',
                recordingDurationSec: 0,
                recordingPitch: 1,
                spriteImageUrls: uploadedUrls,
                presenterName,
                presenterSlideNumber: slideNumber,
                selectedForPresenter: false,
                createdAt: now,
                updatedAt: now
            });
        }

        row.presentations = entries;
        await row.save();

        const current = entries[existingIndex >= 0 ? existingIndex : entries.length - 1];
        res.json({
            ok: true,
            spriteImageUrls: Array.isArray(current?.spriteImageUrls) ? current.spriteImageUrls : [],
            added: uploadedUrls.length,
            presentation: current
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:id/presenter-image', async (req, res) => {
    try {
        const exposeId = String(req.params.id || '').trim();
        const studentId = String(req.body?.studentId || '').trim();
        const presenterName = String(req.body?.presenterName || '').trim();
        const slideNumber = Math.max(1, Number(req.body?.slideNumber || 0));
        const imageUrl = String(req.body?.imageUrl || '').trim();

        if (!exposeId) return res.status(400).json({ error: 'id requis' });
        if (!studentId) return res.status(400).json({ error: 'studentId requis' });
        if (!presenterName) return res.status(400).json({ error: 'presenterName requis' });
        if (!slideNumber) return res.status(400).json({ error: 'slideNumber requis' });
        if (!imageUrl) return res.status(400).json({ error: 'imageUrl requis' });

        const row = await Expose.findById(exposeId);
        if (!row) return res.status(404).json({ error: 'Exposé introuvable' });

        const presenterKey = clean(presenterName);
        const entries = Array.isArray(row.presentations)
            ? row.presentations.map((entry) => (typeof entry?.toObject === 'function' ? entry.toObject() : { ...entry }))
            : [];

        let removed = false;
        row.presentations = entries.map((entry) => {
            const matchesEntry = (
                String(entry?.studentId || '') === studentId
                && clean(entry?.presenterName || '') === presenterKey
                && Math.max(1, Number(entry?.presenterSlideNumber || 1)) === slideNumber
            );
            if (!matchesEntry) return entry;
            const nextUrls = (Array.isArray(entry?.spriteImageUrls) ? entry.spriteImageUrls : [])
                .map((url) => String(url || '').trim())
                .filter((url) => {
                    const keep = url !== imageUrl;
                    if (!keep) removed = true;
                    return keep;
                });
            return {
                ...entry,
                spriteImageUrls: nextUrls,
                updatedAt: removed ? new Date() : entry.updatedAt
            };
        });

        if (!removed) return res.status(404).json({ error: 'Image introuvable' });
        await row.save();
        return res.json({ ok: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});

router.post('/:id/presenter-recording-settings', async (req, res) => {
    try {
        const exposeId = String(req.params.id || '').trim();
        const recordingEntryId = String(req.body?.recordingEntryId || '').trim();
        const recordingPitch = Math.max(0.5, Math.min(2, Number(req.body?.recordingPitch || 1)));

        if (!exposeId) return res.status(400).json({ error: 'id requis' });
        if (!recordingEntryId) return res.status(400).json({ error: 'recordingEntryId requis' });

        const row = await Expose.findById(exposeId);
        if (!row) return res.status(404).json({ error: 'Exposé introuvable' });

        const entries = Array.isArray(row.presentations)
            ? row.presentations.map((entry) => (typeof entry?.toObject === 'function' ? entry.toObject() : { ...entry }))
            : [];
        const idx = entries.findIndex((p) => String(p?._id || '') === recordingEntryId);
        if (idx < 0) return res.status(404).json({ error: 'Présentation élève introuvable' });

        entries[idx] = {
            ...entries[idx],
            recordingPitch,
            updatedAt: new Date()
        };
        row.presentations = entries;
        await row.save();

        if (entries[idx]?.selectedForPresenter === true) {
            await injectPresenterAudioIntoWeb5e({
                presentationTitle: entries[idx].presentationTitle,
                presenterName: String(entries[idx].presenterName || ''),
                slideNumber: Math.max(1, Number(entries[idx].presenterSlideNumber || 1)),
                soundUrl: String(entries[idx].recordingUrl || ''),
                soundPitch: recordingPitch
            });
        }

        res.json({ ok: true, presentation: entries[idx] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/:id/presenter-recording-select', async (req, res) => {
    try {
        const exposeId = String(req.params.id || '').trim();
        const recordingEntryId = String(req.body?.recordingEntryId || '').trim();

        if (!exposeId) return res.status(400).json({ error: 'id requis' });
        if (!recordingEntryId) return res.status(400).json({ error: 'recordingEntryId requis' });

        const row = await Expose.findById(exposeId);
        if (!row) return res.status(404).json({ error: 'Exposé introuvable' });

        const entries = Array.isArray(row.presentations)
            ? row.presentations.map((entry) => (typeof entry?.toObject === 'function' ? entry.toObject() : { ...entry }))
            : [];
        const idx = entries.findIndex((p) => String(p?._id || '') === recordingEntryId);
        if (idx < 0) return res.status(404).json({ error: 'Audio introuvable' });

        const presenterKey = clean(entries[idx]?.presenterName || '');
        const nextEntries = entries.map((entry, entryIndex) => {
            if (clean(entry?.presenterName || '') !== presenterKey) return entry;
            return {
                ...entry,
                selectedForPresenter: entryIndex === idx,
                updatedAt: entryIndex === idx ? new Date() : entry.updatedAt
            };
        });
        row.presentations = nextEntries;
        await row.save();

        await injectPresenterAudioIntoWeb5e({
            presentationTitle: nextEntries[idx].presentationTitle,
            presenterName: String(nextEntries[idx].presenterName || ''),
            slideNumber: Math.max(1, Number(nextEntries[idx].presenterSlideNumber || 1)),
            soundUrl: String(nextEntries[idx].recordingUrl || ''),
            soundPitch: Math.max(0.5, Math.min(2, Number(nextEntries[idx].recordingPitch || 1)))
        });

        res.json({ ok: true, presentation: nextEntries[idx] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:id/presenter-recording/:recordingEntryId', async (req, res) => {
    try {
        const exposeId = String(req.params.id || '').trim();
        const recordingEntryId = String(req.params.recordingEntryId || '').trim();

        if (!exposeId) return res.status(400).json({ error: 'id requis' });
        if (!recordingEntryId) return res.status(400).json({ error: 'recordingEntryId requis' });

        const row = await Expose.findById(exposeId);
        if (!row) return res.status(404).json({ error: 'Exposé introuvable' });

        const entries = Array.isArray(row.presentations)
            ? row.presentations.map((entry) => (typeof entry?.toObject === 'function' ? entry.toObject() : { ...entry }))
            : [];
        const idx = entries.findIndex((p) => String(p?._id || '') === recordingEntryId);
        if (idx < 0) return res.status(404).json({ error: 'Audio introuvable' });

        const target = entries[idx];
        const presenterKey = clean(target?.presenterName || '');
        const remaining = entries.filter((entry) => String(entry?._id || '') !== recordingEntryId);
        const siblings = remaining
            .filter((entry) => clean(entry?.presenterName || '') === presenterKey)
            .sort((a, b) => new Date(b?.updatedAt || b?.createdAt || 0).getTime() - new Date(a?.updatedAt || a?.createdAt || 0).getTime());
        let nextSelectedEntry = null;
        if (target?.selectedForPresenter === true && siblings.length > 0 && !siblings.some((entry) => entry?.selectedForPresenter === true)) {
            const nextSelectedId = String(siblings[0]?._id || '');
            for (let i = 0; i < remaining.length; i += 1) {
                if (String(remaining[i]?._id || '') === nextSelectedId) {
                    remaining[i] = { ...remaining[i], selectedForPresenter: true, updatedAt: new Date() };
                    nextSelectedEntry = remaining[i];
                    break;
                }
            }
        }
        row.presentations = remaining;
        await row.save();

        if (nextSelectedEntry) {
            await injectPresenterAudioIntoWeb5e({
                presentationTitle: nextSelectedEntry.presentationTitle,
                presenterName: String(nextSelectedEntry.presenterName || ''),
                slideNumber: Math.max(1, Number(nextSelectedEntry.presenterSlideNumber || 1)),
                soundUrl: String(nextSelectedEntry.recordingUrl || ''),
                soundPitch: Math.max(0.5, Math.min(2, Number(nextSelectedEntry.recordingPitch || 1)))
            });
        }

        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
