const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const router = express.Router();
const { Student, ControlRecovery } = require('../models/eleve.models');

const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'recoveries');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });
const uploadBatch = multer({ dest: uploadDir });

function finalizeUpload(file) {
    const ext = path.extname(file.originalname || '') || '.jpg';
    const finalName = `${file.filename}${ext}`;
    const finalPath = path.join(uploadDir, finalName);
    fs.renameSync(file.path, finalPath);
    return `/uploads/recoveries/${finalName}`;
}

function cleanQuestionRow(row = {}) {
    return {
        question: String(row?.question || '').trim().slice(0, 500),
        expectedAnswer: String(row?.expectedAnswer || '').trim().slice(0, 1200),
        expectedKeywords: Array.isArray(row?.expectedKeywords)
            ? row.expectedKeywords.map((k) => String(k || '').trim()).filter(Boolean).slice(0, 12)
            : String(row?.expectedKeywords || '')
                .split(',')
                .map((k) => String(k || '').trim())
                .filter(Boolean)
                .slice(0, 12),
        studentAnswer: String(row?.studentAnswer || '').trim().slice(0, 2000),
        oralPreferred: row?.oralPreferred !== false
    };
}

router.get('/list/:studentId', async (req, res) => {
    try {
        const studentId = String(req.params.studentId || '').trim();
        const rows = await ControlRecovery.find({ studentId }).sort({ updatedAt: -1 }).lean();
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/create', async (req, res) => {
    try {
        const studentId = String(req.body?.studentId || '').trim();
        const student = await Student.findById(studentId).lean();
        if (!student) return res.status(404).json({ error: 'Élève introuvable' });
        const doc = await ControlRecovery.create({
            studentId,
            title: String(req.body?.title || '').trim().slice(0, 160),
            subject: String(req.body?.subject || '').trim().slice(0, 80),
            selfQuestions: [{
                question: '',
                expectedAnswer: '',
                expectedKeywords: [],
                studentAnswer: '',
                oralPreferred: true
            }]
        });
        res.json({ ok: true, item: doc });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/upload-photo', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Fichier manquant' });
        res.json({ ok: true, url: finalizeUpload(req.file) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/mobile-access/:id', async (req, res) => {
    try {
        const doc = await ControlRecovery.findById(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Récupération introuvable' });
        if (!doc.mobileAccessToken) {
            doc.mobileAccessToken = crypto.randomBytes(24).toString('hex');
        }
        doc.mobileAccessEnabledAt = new Date();
        await doc.save();
        res.json({ ok: true, token: doc.mobileAccessToken });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/mobile-session/:token', async (req, res) => {
    try {
        const token = String(req.params.token || '').trim();
        if (!token) return res.status(400).json({ error: 'Token manquant' });
        const doc = await ControlRecovery.findOne({ mobileAccessToken: token }).lean();
        if (!doc) return res.status(404).json({ error: 'Session mobile introuvable' });
        const student = await Student.findById(doc.studentId, 'firstName lastName').lean();
        res.json({
            ok: true,
            item: {
                _id: String(doc._id),
                title: doc.title || 'RÉCUPÉRER CONTRÔLE',
                subject: doc.subject || 'GÉNÉRAL',
                submissionMode: doc.submissionMode || 'photo',
                uploadedPhotoUrl: doc.uploadedPhotoUrl || '',
                uploadedPhotoUrls: Array.isArray(doc.uploadedPhotoUrls) ? doc.uploadedPhotoUrls : [],
                phase: Number(doc.phase || 1)
            },
            student: student || null
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/mobile-upload/:token', uploadBatch.array('files', 6), async (req, res) => {
    try {
        const token = String(req.params.token || '').trim();
        if (!token) return res.status(400).json({ error: 'Token manquant' });
        const doc = await ControlRecovery.findOne({ mobileAccessToken: token });
        if (!doc) return res.status(404).json({ error: 'Session mobile introuvable' });
        const files = Array.isArray(req.files) ? req.files : [];
        if (files.length === 0) return res.status(400).json({ error: 'Aucune photo envoyée' });
        const existing = Array.isArray(doc.uploadedPhotoUrls) ? doc.uploadedPhotoUrls : [];
        if (existing.length + files.length > 6) {
            return res.status(400).json({ error: 'Maximum 6 photos par devoir.' });
        }
        const newUrls = files.map(finalizeUpload);
        doc.submissionMode = 'photo';
        doc.uploadedPhotoUrls = [...existing, ...newUrls].slice(0, 6);
        doc.uploadedPhotoUrl = doc.uploadedPhotoUrls[0] || '';
        if (Number(doc.phase || 1) < 1) doc.phase = 1;
        await doc.save();
        res.json({ ok: true, item: doc });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const doc = await ControlRecovery.findById(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Récupération introuvable' });
        if (doc.teacherValidated === true) {
            return res.status(400).json({ error: 'Impossible de supprimer un devoir déjà validé par le professeur.' });
        }
        await ControlRecovery.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/save/:id', async (req, res) => {
    try {
        const doc = await ControlRecovery.findById(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Récupération introuvable' });

        doc.title = String(req.body?.title || doc.title || '').trim().slice(0, 160) || doc.title;
        doc.subject = String(req.body?.subject || doc.subject || '').trim().slice(0, 80) || doc.subject;
        doc.phase = Math.max(1, Math.min(4, Number(req.body?.phase || doc.phase || 1)));
        doc.submissionMode = ['photo', 'keyboard', 'next_course'].includes(String(req.body?.submissionMode || ''))
            ? String(req.body.submissionMode)
            : doc.submissionMode;
        doc.uploadedPhotoUrl = String(req.body?.uploadedPhotoUrl || doc.uploadedPhotoUrl || '').trim().slice(0, 500);
        doc.uploadedPhotoUrls = Array.isArray(req.body?.uploadedPhotoUrls)
            ? req.body.uploadedPhotoUrls.map((url) => String(url || '').trim().slice(0, 500)).filter(Boolean).slice(0, 6)
            : doc.uploadedPhotoUrls;
        if ((!doc.uploadedPhotoUrl || !String(doc.uploadedPhotoUrl).trim()) && Array.isArray(doc.uploadedPhotoUrls) && doc.uploadedPhotoUrls.length > 0) {
            doc.uploadedPhotoUrl = String(doc.uploadedPhotoUrls[0] || '').trim();
        }
        doc.typedRedoText = String(req.body?.typedRedoText || '').trim().slice(0, 12000);
        doc.nextCourseNote = String(req.body?.nextCourseNote || '').trim().slice(0, 1200);
        doc.errorsExplanation = String(req.body?.errorsExplanation || '').trim().slice(0, 12000);
        doc.phase2Mistakes = Array.isArray(req.body?.phase2Mistakes)
            ? req.body.phase2Mistakes.map((row) => ({
                questionNumber: String(row?.questionNumber || '').trim().slice(0, 80),
                whatWasWrong: String(row?.whatWasWrong || '').trim().slice(0, 2000),
                correctionMade: String(row?.correctionMade || '').trim().slice(0, 2000)
            })).filter((row) => row.questionNumber || row.whatWasWrong || row.correctionMade)
            : doc.phase2Mistakes;
        doc.selfQuestions = Array.isArray(req.body?.selfQuestions)
            ? req.body.selfQuestions.map(cleanQuestionRow).filter((row) => row.question || row.expectedAnswer || row.studentAnswer || row.expectedKeywords.length > 0)
            : doc.selfQuestions;
        if (!Array.isArray(doc.selfQuestions) || doc.selfQuestions.length === 0) {
            doc.selfQuestions = [{ question: '', expectedAnswer: '', expectedKeywords: [], studentAnswer: '', oralPreferred: true }];
        }
        doc.status = doc.completedAt ? 'done' : 'todo';
        await doc.save();
        res.json({ ok: true, item: doc });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/complete/:id', async (req, res) => {
    try {
        const doc = await ControlRecovery.findById(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Récupération introuvable' });
        const questionRows = Array.isArray(doc.selfQuestions) ? doc.selfQuestions : [];
        const phase2Mistakes = Array.isArray(doc.phase2Mistakes) ? doc.phase2Mistakes : [];
        const hasRedo = doc.submissionMode === 'photo'
            ? Boolean(doc.uploadedPhotoUrl || (Array.isArray(doc.uploadedPhotoUrls) && doc.uploadedPhotoUrls.length > 0))
            : doc.submissionMode === 'keyboard'
                ? Boolean(String(doc.typedRedoText || '').trim())
                : true;
        const hasErrors = phase2Mistakes.some((row) =>
            String(row?.questionNumber || '').trim()
            && String(row?.whatWasWrong || '').trim()
            && String(row?.correctionMade || '').trim()
        );
        const hasQuestions = questionRows.some((row) => String(row?.question || '').trim() && String(row?.expectedAnswer || '').trim());
        const hasAnswers = questionRows.every((row) => !String(row?.question || '').trim() || Boolean(String(row?.studentAnswer || '').trim()));
        if (!hasRedo || !hasErrors || !hasQuestions || !hasAnswers) {
            const missing = [];
            if (!hasRedo) missing.push('phase1_redo');
            if (!hasErrors) missing.push('phase2_errors');
            if (!hasQuestions) missing.push('phase3_questions');
            if (!hasAnswers) missing.push('phase4_answers');
            return res.status(400).json({
                error: 'Les 4 phases doivent être complétées avant validation.',
                details: {
                    hasRedo,
                    hasErrors,
                    hasQuestions,
                    hasAnswers,
                    questionCount: questionRows.length,
                    phase2MistakeCount: phase2Mistakes.length,
                    submissionMode: doc.submissionMode,
                    missing
                }
            });
        }

        doc.phase = 4;
        doc.status = 'done';
        if (!doc.completedAt) doc.completedAt = new Date();

        if (!doc.awardedBonus) {
            const student = await Student.findById(doc.studentId);
            if (student) {
                if (!Array.isArray(student.behaviorRecords) || student.behaviorRecords.length === 0) {
                    student.behaviorRecords = [{ teacherId: null, crosses: 0, bonuses: 1, weeksToRedemption: 3, nextCrossRemovalAt: null }];
                } else {
                    student.behaviorRecords[0].bonuses = Number(student.behaviorRecords[0].bonuses || 0) + 1;
                }
                student.markModified('behaviorRecords');
                await student.save();
            }
            doc.awardedBonus = true;
        }

        await doc.save();
        res.json({
            ok: true,
            item: doc,
            message: 'Bravo, vous avez terminé le processus de récupération. Votre travail est en cours de validation par le professeur.'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
