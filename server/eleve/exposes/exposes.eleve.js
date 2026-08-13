const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const ProfDrive = require('../../prof/core/drive.prof');

const upload = multer({ dest: path.join(process.cwd(), 'public', 'uploads', 'temp') });

function normalizeCanvasKey(raw = '') {
    const txt = String(raw || '').trim();
    if (!txt) return '';
    const normalized = txt
        .replace(/^https?:\/\/canvas\.com/i, 'https://www.canva.com')
        .replace(/^https?:\/\/www\.canvas\.com/i, 'https://www.canva.com');
    try {
        const u = new URL(normalized);
        const host = String(u.hostname || '').toLowerCase();
        if (!host.includes('canva.com')) return normalized.toLowerCase();
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts[0] === 'design' && parts[1]) {
            const id = parts[1];
            const token = parts[2] || '';
            return `canva:design:${id}:${token}`.toLowerCase();
        }
        return `canva:url:${u.origin}${u.pathname}`.toLowerCase();
    } catch (_) {
        return normalized.toLowerCase();
    }
}

function addClassTarget(set, value) {
    const normalized = String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
    if (!normalized) return;
    set.add(normalized);
}

function normalizeTargetKey(value = '') {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
}

function matchesClassTargets(itemTargets, targetKeys) {
    return (itemTargets || []).some((t) => targetKeys.has(normalizeTargetKey(t)));
}
const academicLevel = (value = '') => (normalizeTargetKey(value).match(/^(6|5|4|3|2|1)/) || [])[1] || '';

async function buildStudentClassTargets(student) {
    const Classroom = mongoose.model('Classroom');
    const Enrollment = mongoose.models.Enrollment ? mongoose.model('Enrollment') : null;
    const targets = new Set();

    addClassTarget(targets, student?.currentClass);

    const classId = student?.classId && String(student.classId);
    if (classId && mongoose.Types.ObjectId.isValid(classId)) {
        const cls = await Classroom.findById(classId, 'name').lean();
        addClassTarget(targets, cls?.name);
    } else if (classId) {
        addClassTarget(targets, classId);
    }

    const groupRaw = (student?.assignedGroups || [])
        .map((g) => String((g && g._id) ? g._id : g))
        .filter(Boolean);
    const groupIds = groupRaw.filter((id) => mongoose.Types.ObjectId.isValid(id));
    const groupNames = groupRaw.filter((id) => !mongoose.Types.ObjectId.isValid(id));

    if (groupIds.length > 0) {
        const groups = await Classroom.find({ _id: { $in: groupIds } }, 'name').lean();
        groups.forEach((g) => addClassTarget(targets, g?.name));
    }
    groupNames.forEach((name) => addClassTarget(targets, name));

    const studentId = student?._id ? String(student._id) : '';
    if (Enrollment && studentId && mongoose.Types.ObjectId.isValid(studentId)) {
        const enrollments = await Enrollment.find({ studentId }, 'classId').lean();
        const enrollClassIds = enrollments
            .map((e) => String(e?.classId || ''))
            .filter((id) => mongoose.Types.ObjectId.isValid(id));
        if (enrollClassIds.length > 0) {
            const enrollClasses = await Classroom.find({ _id: { $in: enrollClassIds } }, 'name').lean();
            enrollClasses.forEach((c) => addClassTarget(targets, c?.name));
        }
    }
    return [...targets];
}

router.get('/list/:studentId', async (req, res) => {
    try {
        const Student = mongoose.model('Student');
        const Chapter = mongoose.model('Chapter');
        const Expose = mongoose.model('Expose');

        const isVisitor = req.query?.visitor === '1';
        const visitorLevel = academicLevel(req.query?.level);
        const student = isVisitor ? { _id: null, currentClass: req.query?.level || '' } : await Student.findById(req.params.studentId).lean();
        if (!student) return res.json([]);

        const classTargets = await buildStudentClassTargets(student);
        const classTargetKeys = new Set(classTargets.map(normalizeTargetKey).filter(Boolean));

        const rawExposes = await Expose.find({
            isEnabled: { $ne: false },
            ...(isVisitor ? {} : { $or: [
                { isAllClass: true },
                { assignedStudents: student._id }
            ] })
        }).sort({ date: -1 }).lean();

        const exposes = rawExposes.filter((x) => {
            if (isVisitor) return (x.targetClassrooms || []).some((target) => academicLevel(target) === visitorLevel);
            const assigned = (x.assignedStudents || []).some((id) => String(id) === String(student._id));
            if (assigned) return true;
            if (!x.isAllClass) return false;
            return matchesClassTargets(x.targetClassrooms, classTargetKeys);
        });

        const chapterIds = [...new Set(exposes.map((x) => String(x.chapterId || '')).filter(Boolean))];
        const chapters = chapterIds.length > 0
            ? await Chapter.find({ _id: { $in: chapterIds } }, '_id title section').lean()
            : [];
        const chapterById = new Map(chapters.map((c) => [String(c._id), c]));

        const rows = exposes
            .filter((x) => x.chapterId && chapterById.has(String(x.chapterId)))
            .map((x) => {
                const chapter = chapterById.get(String(x.chapterId));
                const studentSubmission = (x.presentations || []).find((p) => String(p.studentId) === String(student._id)) || null;
                return {
                    ...x,
                    chapterTitle: chapter?.title || 'CHAPITRE',
                    chapterSection: chapter?.section || 'GÉNÉRAL',
                    studentSubmission
                };
            });

        res.json(rows);
    } catch (e) {
        res.status(500).json([]);
    }
});

router.get('/title-suggestions/:exposeId', async (req, res) => {
    try {
        const Expose = mongoose.model('Expose');
        const exposeId = String(req.params.exposeId || '').trim();
        const q = String(req.query?.q || '').trim().toLowerCase();
        if (!exposeId || !mongoose.Types.ObjectId.isValid(exposeId)) return res.json([]);
        const row = await Expose.findById(exposeId, 'presentations').lean();
        if (!row) return res.json([]);
        const titles = [...new Set((row.presentations || [])
            .map((p) => String(p?.presentationTitle || '').trim())
            .filter(Boolean))]
            .filter((t) => !q || t.toLowerCase().includes(q))
            .slice(0, 30);
        res.json(titles);
    } catch (e) {
        res.status(500).json([]);
    }
});

router.get('/canvas-title/:exposeId', async (req, res) => {
    try {
        const Expose = mongoose.model('Expose');
        const exposeId = String(req.params.exposeId || '').trim();
        const canvasUrl = String(req.query?.canvasUrl || '').trim();
        if (!exposeId || !mongoose.Types.ObjectId.isValid(exposeId)) return res.json({ locked: false, title: '' });
        if (!canvasUrl) return res.json({ locked: false, title: '' });

        const row = await Expose.findById(exposeId, 'presentations').lean();
        if (!row) return res.json({ locked: false, title: '' });

        const key = normalizeCanvasKey(canvasUrl);
        const linked = (row.presentations || []).find((p) => {
            const pKey = normalizeCanvasKey(p?.canvasUrl || '');
            return pKey && pKey === key && String(p?.presentationTitle || '').trim();
        });

        if (!linked) return res.json({ locked: false, title: '' });
        return res.json({ locked: true, title: String(linked.presentationTitle || '').trim() });
    } catch (e) {
        res.status(500).json({ locked: false, title: '' });
    }
});

router.post('/submit', upload.single('audio'), async (req, res) => {
    try {
        const Expose = mongoose.model('Expose');
        const exposeId = String(req.body?.exposeId || '').trim();
        const studentId = String(req.body?.studentId || '').trim();
        const presentationTitle = String(req.body?.presentationTitle || '').trim().slice(0, 140);
        const canvasUrl = String(req.body?.canvasUrl || '').trim();
        const slidesText = String(req.body?.slidesText || '').trim().slice(0, 400);
        const recordingDurationSec = Math.max(0, Number(req.body?.recordingDurationSec || 0));

        if (!exposeId || !studentId) return res.status(400).json({ error: 'exposeId et studentId requis' });

        const expose = await Expose.findById(exposeId);
        if (!expose) return res.status(404).json({ error: 'Exposé introuvable' });

        // Verrou serveur: un même lien Canva garde un titre unique pour tous.
        const incomingCanvasKey = normalizeCanvasKey(canvasUrl);
        let enforcedTitle = presentationTitle;
        if (incomingCanvasKey) {
            const existingLinked = (expose.presentations || []).find((p) => {
                const pKey = normalizeCanvasKey(p?.canvasUrl || '');
                const t = String(p?.presentationTitle || '').trim();
                return pKey && pKey === incomingCanvasKey && t;
            });
            if (existingLinked) enforcedTitle = String(existingLinked.presentationTitle || '').trim();
        }

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

        const now = new Date();
        const entries = Array.isArray(expose.presentations) ? [...expose.presentations] : [];
        const idx = entries.findIndex((p) => String(p.studentId) === studentId);
        const previous = idx >= 0 ? entries[idx] : null;
        const nextEntry = {
            studentId,
            presentationTitle: enforcedTitle || String(previous?.presentationTitle || ''),
            canvasUrl: canvasUrl || String(previous?.canvasUrl || ''),
            slidesText: slidesText || String(previous?.slidesText || ''),
            recordingUrl: recordingUrl || String(previous?.recordingUrl || ''),
            recordingDurationSec: recordingDurationSec || Number(previous?.recordingDurationSec || 0),
            createdAt: previous?.createdAt || now,
            updatedAt: now
        };

        if (idx >= 0) entries[idx] = nextEntry;
        else entries.push(nextEntry);
        expose.presentations = entries;
        await expose.save();

        res.json({ ok: true, submission: nextEntry, warning: uploadWarning || null });
    } catch (e) {
        console.error('❌ [ELEVE EXPOSE SUBMIT]', {
            exposeId: req.body?.exposeId,
            studentId: req.body?.studentId,
            hasFile: !!req.file,
            message: e.message
        });
        res.status(500).json({ error: e.message });
    } finally {
        if (req.file) {
            try { fs.unlinkSync(req.file.path); } catch (_) {}
        }
    }
});

module.exports = router;
