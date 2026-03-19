const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const { Student, ControlRecovery } = require('../models/eleve.models');

const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'recoveries');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

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
        const ext = path.extname(req.file.originalname || '') || '.jpg';
        const finalName = `${req.file.filename}${ext}`;
        const finalPath = path.join(uploadDir, finalName);
        fs.renameSync(req.file.path, finalPath);
        res.json({ ok: true, url: `/uploads/recoveries/${finalName}` });
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
        const hasRedo = doc.submissionMode === 'photo'
            ? Boolean(doc.uploadedPhotoUrl)
            : doc.submissionMode === 'keyboard'
                ? Boolean(String(doc.typedRedoText || '').trim())
                : Boolean(String(doc.nextCourseNote || '').trim());
        const hasErrors = Boolean(String(doc.errorsExplanation || '').trim());
        const hasQuestions = questionRows.some((row) => String(row?.question || '').trim() && String(row?.expectedAnswer || '').trim());
        const hasAnswers = questionRows.every((row) => !String(row?.question || '').trim() || Boolean(String(row?.studentAnswer || '').trim()));
        if (!hasRedo || !hasErrors || !hasQuestions || !hasAnswers) {
            return res.status(400).json({ error: 'Les 4 phases doivent être complétées avant validation.' });
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
            message: 'Bravo tu as récupéré ton contrôle, tu obtiens un niveau de plus !'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
