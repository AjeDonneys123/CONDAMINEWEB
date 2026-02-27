// @signatures: ProfScansRouter, sessions, upload
const express = require('express');
const router = express.Router();
const { ScanSession, Student } = require('../models/prof.models');
const ProfDrive = require('../core/drive.prof');
const ScanAI = require('../../domains/scans/ai/scan.ai');
const MistakeService = require('../../services/mistake.service');
const multer = require('multer');
const upload = multer({ dest: 'public/uploads/temp' });
const defaultAiInstructions = `Objectif prioritaire: comprendre le sens réel de ce que l'élève a écrit.
Ne pas corriger l'orthographe pour l'instant.
Rester proche des mots originaux quand ils sont lisibles.`;

/**
 * 📸 BLOC PROF : LOGIQUE SCANS (/api/scans)
 */

router.get('/sessions', async (req, res) => {
    res.json(await ScanSession.find({}).sort({ date: -1 }).lean());
});

router.post('/sessions', async (req, res) => {
    try {
        const { title, teacherId } = req.body || {};
        const created = await ScanSession.create({ title, teacherId, aiInstructions: defaultAiInstructions });
        res.json(created);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/sessions/:id/instructions', async (req, res) => {
    try {
        const aiInstructions = String(req.body?.aiInstructions || '').trim();
        const updated = await ScanSession.findByIdAndUpdate(
            req.params.id,
            { $set: { aiInstructions } },
            { new: true }
        );
        if (!updated) return res.status(404).json({ error: "Session introuvable" });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/sessions/:id', async (req, res) => {
    try {
        await ScanSession.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/upload', upload.single('file'), async (req, res) => {
    const { sessionId, type } = req.body;
    const folderId = await ProfDrive.getOrCreateFolder("SCANS");
    const driveFile = await ProfDrive.uploadFile(req.file.originalname, req.file.path, folderId);
    const url = `/api/structure/proxy/${driveFile.id}`;
    
    const update = type === 'SUBJECT' ? { $push: { subjectUrls: url } } : { $push: { copyUrls: url } };
    await ScanSession.findByIdAndUpdate(sessionId, update);
    res.json({ url });
});

router.post('/delete-file', async (req, res) => {
    try {
        const { sessionId, url, type } = req.body || {};
        if (!sessionId || !url) return res.status(400).json({ error: "sessionId/url manquants" });
        const session = await ScanSession.findById(sessionId);
        if (!session) return res.status(404).json({ error: "Session introuvable" });

        const fileId = String(url).includes('/proxy/') ? String(url).split('/proxy/')[1] : '';
        if (fileId) {
            try {
                await ProfDrive.deleteFile(fileId);
            } catch (e) {
                console.error(`❌ [SCANS] Drive delete fail fileId=${fileId}:`, e.message);
            }
        }

        if (type === 'SUBJECT') {
            await ScanSession.updateOne({ _id: sessionId }, { $pull: { subjectUrls: url } });
        } else {
            await ScanSession.updateOne(
                { _id: sessionId },
                { $pull: { copyUrls: url, corrections: { originalUrl: url } } }
            );
        }
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

function norm(v = '') {
    return String(v || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isLyceeClass(className = '') {
    const c = String(className || '').toUpperCase().replace(/\s+/g, '');
    return /^(2DE|2NDE|1ERE|1ER|PREMIERE|TERM|TERMINALE|TLE)/.test(c);
}

function gradeToScore20(letter = '') {
    const g = String(letter || '').toUpperCase().trim();
    if (g === 'A+') return 19;
    if (g === 'A') return 16;
    if (g === 'B') return 13;
    if (g === 'C') return 8;
    return 10;
}

function sanitizeLetterGrade(grade = '') {
    const g = String(grade || '').toUpperCase().trim();
    if (g === 'A+' || g === 'A' || g === 'B' || g === 'C') return g;
    return 'B';
}

async function buildCorrectionForCopy(session, copyUrl, roster, students) {
    if (!String(copyUrl).includes('/proxy/')) return null;
    const aiResult = await ScanAI.correctCopy(copyUrl, session.subjectUrls || [], session.aiInstructions || '', students);
    const studentName = String(aiResult.studentName || 'Inconnu').trim();
    const n = norm(studentName);
    const matched = roster.find(s => s.fullNameNorm === n)
        || roster.find(s => s.fullNameNorm.includes(n) || n.includes(s.fullNameNorm));
    const studentClass = matched?.className || '';
    const studentId = matched?.id || null;
    const lycee = isLyceeClass(studentClass);
    const letter = sanitizeLetterGrade(aiResult.grade || 'B');
    const score20 = lycee
        ? (Number.isFinite(Number(aiResult.score20)) ? Number(aiResult.score20) : gradeToScore20(letter))
        : null;

    return {
        originalUrl: copyUrl,
        studentName: studentName || "Inconnu",
        studentId,
        studentClass,
        isLycee: lycee,
        grade: letter,
        score20,
        appreciation: aiResult.appreciation || "Pas d'avis.",
        transcription: aiResult.transcription || "...",
        literalTranscription: aiResult.literalTranscription || "",
        spellingMistakes: Array.isArray(aiResult.spellingMistakes) ? aiResult.spellingMistakes : [],
        questionFeedback: Array.isArray(aiResult.questionFeedback) ? aiResult.questionFeedback : [],
        transcriptionVariants: (aiResult && typeof aiResult.transcriptionVariants === 'object' && aiResult.transcriptionVariants)
            ? aiResult.transcriptionVariants
            : {
                literal_final: { label: 'Transcription fidèle', text: aiResult.literalTranscription || aiResult.transcription || "..." },
                orthography_corrected: { label: 'Orthographe corrigée', text: aiResult.transcription || "..." },
                content_feedback: { label: 'Feedback fond', text: Array.isArray(aiResult.questionFeedback) && aiResult.questionFeedback.length ? aiResult.questionFeedback.join('\n') : (aiResult.appreciation || "Pas d'avis.") }
            },
        qualityFlags: Array.isArray(aiResult.qualityFlags) ? aiResult.qualityFlags : [],
        ocrConfidence: Number.isFinite(Number(aiResult.ocrConfidence)) ? Number(aiResult.ocrConfidence) : null,
        mistakes: Array.isArray(aiResult.spellingMistakes) ? aiResult.spellingMistakes : []
    };
}

function buildCorrectionFromAiResult(aiResult, copyUrl, roster) {
    const studentName = String(aiResult?.studentName || 'Inconnu').trim();
    const n = norm(studentName);
    const matched = roster.find(s => s.fullNameNorm === n)
        || roster.find(s => s.fullNameNorm.includes(n) || n.includes(s.fullNameNorm));
    const studentClass = matched?.className || '';
    const studentId = matched?.id || null;
    const lycee = isLyceeClass(studentClass);
    const letter = sanitizeLetterGrade(aiResult?.grade || 'B');
    const score20 = lycee
        ? (Number.isFinite(Number(aiResult?.score20)) ? Number(aiResult.score20) : gradeToScore20(letter))
        : null;

    return {
        originalUrl: copyUrl,
        studentName: studentName || "Inconnu",
        studentId,
        studentClass,
        isLycee: lycee,
        grade: letter,
        score20,
        appreciation: aiResult?.appreciation || "Pas d'avis.",
        transcription: aiResult?.transcription || "...",
        literalTranscription: aiResult?.literalTranscription || "",
        spellingMistakes: Array.isArray(aiResult?.spellingMistakes) ? aiResult.spellingMistakes : [],
        questionFeedback: Array.isArray(aiResult?.questionFeedback) ? aiResult.questionFeedback : [],
        transcriptionVariants: (aiResult && typeof aiResult.transcriptionVariants === 'object' && aiResult.transcriptionVariants)
            ? aiResult.transcriptionVariants
            : {
                literal_final: { label: 'Transcription fidèle', text: aiResult?.literalTranscription || aiResult?.transcription || "..." },
                orthography_corrected: { label: 'Orthographe corrigée', text: aiResult?.transcription || "..." },
                content_feedback: { label: 'Feedback fond', text: Array.isArray(aiResult?.questionFeedback) && aiResult.questionFeedback.length ? aiResult.questionFeedback.join('\n') : (aiResult?.appreciation || "Pas d'avis.") }
            },
        qualityFlags: Array.isArray(aiResult?.qualityFlags) ? aiResult.qualityFlags : [],
        ocrConfidence: Number.isFinite(Number(aiResult?.ocrConfidence)) ? Number(aiResult.ocrConfidence) : null,
        mistakes: Array.isArray(aiResult?.spellingMistakes) ? aiResult.spellingMistakes : []
    };
}

router.post('/correct/:sessionId', async (req, res) => {
    try {
        const session = await ScanSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ error: "Session introuvable" });
        const students = await Student.find({}, 'firstName lastName currentClass').lean();
        const roster = students.map(s => ({
            id: s._id,
            fullName: `${s.firstName || ''} ${s.lastName || ''}`.trim(),
            fullNameNorm: norm(`${s.firstName || ''} ${s.lastName || ''}`),
            className: s.currentClass || ''
        }));

        const finalResults = [];
        for (const copyUrl of (session.copyUrls || [])) {
            try {
                const one = await buildCorrectionForCopy(session, copyUrl, roster, students);
                if (one) {
                    finalResults.push(one);
                    if (one.studentId) {
                        await MistakeService.recordForStudent({
                            studentId: one.studentId,
                            mistakes: one.spellingMistakes || [],
                            sourceType: 'scan',
                            sourceRef: `${session._id}:${copyUrl}`,
                            context: one.studentName || ''
                        });
                    }
                }
            } catch (e) {
                console.error("❌ [SCANS] Corr Error:", e.message);
            }
        }
        session.corrections = finalResults;
        await session.save();
        res.json(session);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/correct-one/:sessionId', async (req, res) => {
    try {
        const session = await ScanSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ error: "Session introuvable" });
        const copyUrl = String(req.body?.copyUrl || '');
        if (!copyUrl) return res.status(400).json({ error: "copyUrl manquant" });
        if (!(session.copyUrls || []).includes(copyUrl)) {
            return res.status(404).json({ error: "Copie introuvable dans la session" });
        }

        const students = await Student.find({}, 'firstName lastName currentClass').lean();
        const roster = students.map(s => ({
            id: s._id,
            fullName: `${s.firstName || ''} ${s.lastName || ''}`.trim(),
            fullNameNorm: norm(`${s.firstName || ''} ${s.lastName || ''}`),
            className: s.currentClass || ''
        }));
        const one = await buildCorrectionForCopy(session, copyUrl, roster, students);
        if (!one) return res.status(400).json({ error: "URL copie invalide" });
        if (one.studentId) {
            await MistakeService.recordForStudent({
                studentId: one.studentId,
                mistakes: one.spellingMistakes || [],
                sourceType: 'scan',
                sourceRef: `${session._id}:${copyUrl}`,
                context: one.studentName || ''
            });
        }

        const existing = Array.isArray(session.corrections) ? session.corrections : [];
        const idx = existing.findIndex(c => String(c.originalUrl) === copyUrl);
        if (idx >= 0) existing[idx] = one;
        else existing.push(one);
        session.corrections = existing;
        await session.save();
        res.json({ ok: true, correction: one, session });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/correct-one-compare/:sessionId', async (req, res) => {
    try {
        const session = await ScanSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ error: "Session introuvable" });
        const copyUrl = String(req.body?.copyUrl || '');
        if (!copyUrl) return res.status(400).json({ error: "copyUrl manquant" });
        if (!(session.copyUrls || []).includes(copyUrl)) {
            return res.status(404).json({ error: "Copie introuvable dans la session" });
        }

        const students = await Student.find({}, 'firstName lastName currentClass').lean();
        const roster = students.map(s => ({
            id: s._id,
            fullName: `${s.firstName || ''} ${s.lastName || ''}`.trim(),
            fullNameNorm: norm(`${s.firstName || ''} ${s.lastName || ''}`),
            className: s.currentClass || ''
        }));

        const variants = await ScanAI.correctCopyVariants(copyUrl, session.subjectUrls || [], session.aiInstructions || '', students);
        const response = {
            imageOnly: buildCorrectionFromAiResult(variants.imageOnly, copyUrl, roster),
            hybrid: buildCorrectionFromAiResult(variants.hybrid, copyUrl, roster),
            ocrRefine: buildCorrectionFromAiResult(variants.ocrRefine, copyUrl, roster)
        };

        const mergeTranscriptionVariants = {
            literal_final: response.hybrid?.transcriptionVariants?.literal_final || { label: 'Transcription fidèle', text: response.hybrid?.literalTranscription || response.hybrid?.transcription || '' },
            orthography_corrected: response.hybrid?.transcriptionVariants?.orthography_corrected || { label: 'Orthographe corrigée', text: response.hybrid?.transcription || '' },
            content_feedback: response.hybrid?.transcriptionVariants?.content_feedback || {
                label: 'Feedback fond',
                text: Array.isArray(response.hybrid?.questionFeedback) && response.hybrid.questionFeedback.length
                    ? response.hybrid.questionFeedback.join('\n')
                    : (response.hybrid?.appreciation || '')
            }
        };
        const mergedCorrection = {
            ...response.hybrid,
            transcriptionVariants: mergeTranscriptionVariants,
            appreciation: 'Comparatif A/B/C généré (hybride utilisé comme base).'
        };
        if (mergedCorrection.studentId) {
            await MistakeService.recordForStudent({
                studentId: mergedCorrection.studentId,
                mistakes: mergedCorrection.spellingMistakes || [],
                sourceType: 'scan',
                sourceRef: `${session._id}:${copyUrl}`,
                context: mergedCorrection.studentName || ''
            });
        }
        const existing = Array.isArray(session.corrections) ? session.corrections : [];
        const idx = existing.findIndex(c => String(c.originalUrl) === copyUrl);
        if (idx >= 0) existing[idx] = mergedCorrection;
        else existing.push(mergedCorrection);
        session.corrections = existing;
        await session.save();

        res.json({ ok: true, variants: response, mergedCorrection, session });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
