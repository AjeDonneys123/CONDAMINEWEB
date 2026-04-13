const express = require('express');
const router = express.Router();
const { Expose } = require('../models/prof.models');
const { Web5eEntry } = require('../../web5e/models.web5e');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const fetch = require('node-fetch');
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

function normalizeAnimationBlockForStorage(block = null) {
    if (!block || typeof block !== 'object') return null;
    return {
        ...block,
        actions: Array.isArray(block.actions) ? block.actions : []
    };
}

function parseDataUrlImage(value = '') {
    const txt = String(value || '').trim();
    const match = txt.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return null;
    return {
        mimeType: match[1],
        buffer: Buffer.from(match[2], 'base64')
    };
}

function extensionFromMimeType(mimeType = '') {
    const cleanMime = String(mimeType || '').toLowerCase();
    if (cleanMime.includes('png')) return 'png';
    if (cleanMime.includes('webp')) return 'webp';
    if (cleanMime.includes('jpeg') || cleanMime.includes('jpg')) return 'jpg';
    return 'png';
}

async function persistAnimationFrames(block = null) {
    const normalized = normalizeAnimationBlockForStorage(block);
    if (!normalized || !Array.isArray(normalized.actions)) return normalized;
    const folderId = await ProfDrive.getOrCreateFolder('CONDA_EXPOSES_SPRITES');

    const nextActions = await Promise.all(normalized.actions.map(async (action) => {
        const frames = Array.isArray(action?.frames) ? action.frames : [];
        const nextFrames = await Promise.all(frames.map(async (rawFrame, index) => {
            const frame = rawFrame && typeof rawFrame === 'object' ? { ...rawFrame } : rawFrame;
            const parsed = parseDataUrlImage(frame?.url || '');
            if (!parsed) return frame;
            const ext = extensionFromMimeType(parsed.mimeType);
            const tempPath = path.join(os.tmpdir(), `conda_sprite_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`);
            fs.writeFileSync(tempPath, parsed.buffer);
            try {
                const driveFile = await ProfDrive.uploadFile(`sprite_frame_${Date.now()}_${index}.${ext}`, tempPath, folderId);
                return {
                    ...frame,
                    url: `/api/structure/proxy/${driveFile.id}`
                };
            } finally {
                try { fs.unlinkSync(tempPath); } catch (_) {}
            }
        }));
        return {
            ...action,
            frames: nextFrames
        };
    }));

    return {
        ...normalized,
        actions: nextActions
    };
}

function collectEmbeddedImageUrls(block = null) {
    if (!block || typeof block !== 'object') return [];
    const urls = [];
    const actorImageUrl = String(block?.actorImageUrl || '').trim();
    if (actorImageUrl.startsWith('data:image/')) urls.push(actorImageUrl);
    const actions = Array.isArray(block?.actions) ? block.actions : [];
    actions.forEach((action) => {
        const frames = Array.isArray(action?.frames) ? action.frames : [];
        frames.forEach((frame) => {
            const url = String(frame?.url || '').trim();
            if (url.startsWith('data:image/')) urls.push(url);
        });
    });
    return urls;
}

function guessMimeTypeFromUrl(url = '') {
    const txt = String(url || '').toLowerCase();
    if (txt.includes('.webp')) return 'image/webp';
    if (txt.includes('.jpg') || txt.includes('.jpeg')) return 'image/jpeg';
    return 'image/png';
}

async function fetchImageAsInlineData(imageUrl, req) {
    const raw = String(imageUrl || '').trim();
    if (!raw) throw new Error('imageUrl vide');
    const absoluteUrl = /^https?:\/\//i.test(raw)
        ? raw
        : `${req.protocol}://${req.get('host')}${raw.startsWith('/') ? '' : '/'}${raw}`;
    const response = await fetch(absoluteUrl);
    if (!response.ok) throw new Error(`fetch image HTTP ${response.status}`);
    const buffer = await response.buffer();
    const mimeType = String(response.headers.get('content-type') || '').trim() || guessMimeTypeFromUrl(raw);
    return {
        mimeType,
        data: buffer.toString('base64')
    };
}

function buildAnimationPrompt() {
    return [
        'Transform this single character image into a clean 4-frame sprite sequence.',
        'Keep the exact same character identity, clothes, face, colors, camera angle, and transparent background style.',
        'The 4 frames must show only a continuous speaking animation.',
        'Only the lips and mouth should move slightly from frame to frame.',
        'Do not move the head, hands, arms, body, or camera.',
        'Do not add any hand gesture or waving motion.',
        'Frame 1: mouth closed, neutral pose.',
        'Frame 2: lips slightly open.',
        'Frame 3: mouth open clearly for speech.',
        'Frame 4: mouth half-open as speech continues.',
        'Return only the generated sprite frame image, no text, no collage caption, no border, no background scene.'
    ].join(' ');
}

async function generateSpriteFramesFromImage({ imageUrl, req }) {
    const inlineData = await fetchImageAsInlineData(imageUrl, req);
    const apiKey = String(
        process.env.GEMINI_API_KEY
        || process.env.GOOGLE_API_KEY
        || process.env.GOOGLE_AI_API_KEY
        || ''
    ).trim();
    if (!apiKey) throw new Error('Clé Gemini absente');

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
            contents: [{
                role: 'user',
                parts: [
                    { text: buildAnimationPrompt() },
                    {
                        inline_data: {
                            mime_type: inlineData.mimeType,
                            data: inlineData.data
                        }
                    }
                ]
            }],
            generationConfig: {
                responseModalities: ['TEXT', 'IMAGE']
            }
        })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.error) {
        const message = data?.error?.message || `Gemini HTTP ${response.status}`;
        console.error('[EXPOSES][SPRITE_GEN_ERROR]', { imageUrl, status: response.status, message });
        throw new Error(message);
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const images = parts
        .map((part) => part?.inlineData || part?.inline_data || null)
        .filter(Boolean)
        .map((part, index) => `data:${part.mimeType || 'image/png'};base64,${part.data || ''}`)
        .filter((value) => value.includes('base64,') && value.length > 32);

    if (!images.length) {
        console.error('[EXPOSES][SPRITE_GEN_EMPTY]', {
            imageUrl,
            candidateCount: Array.isArray(data?.candidates) ? data.candidates.length : 0
        });
        throw new Error('Aucune image générée');
    }

    const frameDurationSec = 0.18;
    return {
        type: 'animation',
        title: 'Animation IA',
        actorName: 'Personnage',
        actorImageUrl: String(imageUrl || '').trim(),
        actorX: 120,
        actorY: 120,
        actorWidth: 140,
        actorHeight: 140,
        savedActions: [],
        actions: [{
            id: `action_${Date.now()}`,
            name: 'Parler',
            frames: images.slice(0, 4).map((url, index) => ({
                id: `frame_${Date.now()}_${index}`,
                url,
                width: 140,
                height: 140,
                scale: 1,
                offsetX: 0,
                offsetY: 0
            })),
            frameUrlInput: '',
            soundUrl: '',
            soundPitch: 1,
            frameDurationSec,
            startSec: 0,
            durationSec: Number((frameDurationSec * Math.min(images.length, 4)).toFixed(2))
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
                            : [],
                        spriteAnimations: Array.isArray(row?.spriteAnimations)
                            ? row.spriteAnimations.map((item) => ({
                                imageUrl: String(item?.imageUrl || '').trim(),
                                animationBlock: normalizeAnimationBlockForStorage(item?.animationBlock || null)
                            })).filter((item) => item.imageUrl)
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
                spriteAnimations: [],
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
                spriteAnimations: (Array.isArray(entry?.spriteAnimations) ? entry.spriteAnimations : [])
                    .filter((item) => String(item?.imageUrl || '').trim() !== imageUrl),
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

router.post('/:id/presenter-image-animation', async (req, res) => {
    try {
        const exposeId = String(req.params.id || '').trim();
        const studentId = String(req.body?.studentId || '').trim();
        const presenterName = String(req.body?.presenterName || '').trim();
        const slideNumber = Math.max(1, Number(req.body?.slideNumber || 0));
        const imageUrl = String(req.body?.imageUrl || '').trim();
        const animationBlock = await persistAnimationFrames(req.body?.animationBlock || null);

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
        let targetIndex = entries.findIndex((entry) => (
            String(entry?.studentId || '') === studentId
            && clean(entry?.presenterName || '') === presenterKey
            && Math.max(1, Number(entry?.presenterSlideNumber || 1)) === slideNumber
        ));
        if (targetIndex < 0) {
            // L'editeur agrege les images par eleve: si le triplet presenter/slide diverge,
            // on retombe sur l'entree qui porte effectivement cette image.
            targetIndex = entries.findIndex((entry) => (
                String(entry?.studentId || '') === studentId
                && (Array.isArray(entry?.spriteImageUrls) ? entry.spriteImageUrls : [])
                    .map((url) => String(url || '').trim())
                    .includes(imageUrl)
            ));
        }
        if (targetIndex < 0) return res.status(404).json({ error: 'Présentation élève introuvable' });

        const nextAnimations = (Array.isArray(entries[targetIndex]?.spriteAnimations) ? entries[targetIndex].spriteAnimations : [])
            .filter((item) => String(item?.imageUrl || '').trim() !== imageUrl);
        nextAnimations.push({
            imageUrl,
            animationBlock
        });

        entries[targetIndex] = {
            ...entries[targetIndex],
            spriteAnimations: nextAnimations,
            updatedAt: new Date()
        };

        row.presentations = entries;
        await row.save();
        const embeddedCount = nextAnimations.reduce((sum, item) => (
            sum + collectEmbeddedImageUrls(item?.animationBlock || null).length
        ), 0);
        return res.json({ ok: true, spriteAnimations: nextAnimations, embeddedCount });
    } catch (e) {
        console.error('[EXPOSES][SAVE_SPRITE_ANIMATION]', e.message);
        return res.status(500).json({ error: e.message });
    }
});

router.post('/:id/generate-class-sprite-animations', async (req, res) => {
    try {
        const exposeId = String(req.params.id || '').trim();
        if (!exposeId) return res.status(400).json({ error: 'id requis' });

        const row = await Expose.findById(exposeId);
        if (!row) return res.status(404).json({ error: 'Exposé introuvable' });

        const entries = Array.isArray(row.presentations)
            ? row.presentations.map((entry) => (typeof entry?.toObject === 'function' ? entry.toObject() : { ...entry }))
            : [];

        let generated = 0;
        const errors = [];
        const nextEntries = [];

        for (const entry of entries) {
            const imageUrls = (Array.isArray(entry?.spriteImageUrls) ? entry.spriteImageUrls : [])
                .map((url) => String(url || '').trim())
                .filter(Boolean);
            if (!imageUrls.length) {
                nextEntries.push(entry);
                continue;
            }

            const nextAnimations = (Array.isArray(entry?.spriteAnimations) ? entry.spriteAnimations : [])
                .filter((item) => !imageUrls.includes(String(item?.imageUrl || '').trim()));

            for (const imageUrl of imageUrls) {
                try {
                    const animationBlock = await persistAnimationFrames(
                        await generateSpriteFramesFromImage({ imageUrl, req })
                    );
                    nextAnimations.push({ imageUrl, animationBlock });
                    generated += 1;
                } catch (error) {
                    console.error('[EXPOSES][SPRITE_BATCH_ITEM_ERROR]', {
                        exposeId,
                        studentId: String(entry?.studentId || ''),
                        presenterName: String(entry?.presenterName || ''),
                        slideNumber: Math.max(1, Number(entry?.presenterSlideNumber || 1)),
                        imageUrl,
                        message: error.message
                    });
                    errors.push({
                        studentId: String(entry?.studentId || ''),
                        presenterName: String(entry?.presenterName || ''),
                        slideNumber: Math.max(1, Number(entry?.presenterSlideNumber || 1)),
                        imageUrl,
                        error: error.message
                    });
                }
            }

            nextEntries.push({
                ...entry,
                spriteAnimations: nextAnimations,
                updatedAt: new Date()
            });
        }

        row.presentations = nextEntries;
        await row.save();
        const remainingEmbedded = nextEntries.reduce((sum, entry) => (
            sum + (Array.isArray(entry?.spriteAnimations) ? entry.spriteAnimations.reduce((acc, item) => (
                acc + collectEmbeddedImageUrls(item?.animationBlock || null).length
            ), 0) : 0)
        ), 0);
        return res.json({
            ok: true,
            generated,
            totalEntries: nextEntries.length,
            errors,
            remainingEmbedded
        });
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
