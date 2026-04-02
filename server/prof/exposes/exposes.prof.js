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

function createDefaultAnimationBlock(soundUrl = '') {
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
            spritesOpen: false,
            spriteUrlOpen: false,
            spriteEditorOpen: false,
            selectedFrameIndex: 0
        }]
    };
}

async function injectPresenterAudioIntoWeb5e({ presentationTitle = '', presenterName = '', slideNumber = 0, soundUrl = '' }) {
    const safeTitle = clean(presentationTitle);
    const safePresenter = clean(presenterName);
    const safeSlideNumber = Math.max(1, Number(slideNumber || 0));
    const safeSoundUrl = String(soundUrl || '').trim();
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
                    : createDefaultAnimationBlock(safeSoundUrl);
                const currentActions = Array.isArray(currentAnimation.actions) ? currentAnimation.actions : [];
                const parlerIndex = currentActions.findIndex((action) => clean(action?.name || '') === 'parler');
                const nextActions = parlerIndex >= 0
                    ? currentActions.map((action, actionIndex) => (
                        actionIndex === parlerIndex ? { ...action, soundUrl: safeSoundUrl } : action
                    ))
                    : [{
                        id: `action_${Date.now()}`,
                        name: 'Parler',
                        frames: [],
                        frameUrlInput: '',
                        soundUrl: safeSoundUrl,
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
        const entries = Array.isArray(row.presentations) ? [...row.presentations] : [];
        const idx = entries.findIndex((p) => String(p.studentId) === studentId && clean(p.presentationTitle) === clean(presentationTitle));
        const previous = idx >= 0 ? entries[idx] : null;
        const nextEntry = {
            studentId,
            presentationTitle: presentationTitle || String(previous?.presentationTitle || ''),
            canvasUrl: String(previous?.canvasUrl || ''),
            slidesText: String(previous?.slidesText || ''),
            recordingUrl,
            recordingDurationSec,
            presenterName,
            presenterSlideNumber: slideNumber,
            createdAt: previous?.createdAt || now,
            updatedAt: now
        };
        if (idx >= 0) entries[idx] = { ...previous?.toObject?.(), ...nextEntry };
        else entries.push(nextEntry);
        row.presentations = entries;
        await row.save();

        const injection = await injectPresenterAudioIntoWeb5e({
            presentationTitle,
            presenterName,
            slideNumber,
            soundUrl: recordingUrl
        });

        res.json({
            ok: true,
            presentation: nextEntry,
            web5eLinked: Boolean(injection.updated),
            warning: uploadWarning || null
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
