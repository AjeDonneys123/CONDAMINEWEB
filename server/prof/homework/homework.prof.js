// @signatures: ProfHomeworkRouter, listAll, create, delete, getOne
const express = require('express');
const router = express.Router();
const { Homework, Submission, Student, Classroom, HomeworkDraftDoc } = require('../models/prof.models');
const ProfDrive = require('../core/drive.prof');
const AIEngine = require('../../core/ai.engine');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const upload = multer({ dest: path.join(process.cwd(), 'public', 'uploads', 'temp') });

const hashCorrectionSource = (lvl = {}) => crypto
    .createHash('sha1')
    .update(JSON.stringify({
        instruction: String(lvl.instruction || ''),
        aiHints: String(lvl.aiHints || ''),
        dnbSection: String(lvl.dnbSection || ''),
        dnbSubject: String(lvl.dnbSubject || ''),
        maxPoints: lvl.maxPoints || ''
    }))
    .digest('hex');

async function generateCompactDnbCorrection(lvl = {}) {
    const sourceHash = hashCorrectionSource(lvl);
    if (lvl.compactCorrection && lvl.compactCorrectionSourceHash === sourceHash) return lvl;
    const correctionText = String(lvl.aiHints || '').trim();
    const instructionText = String(lvl.instruction || '').trim();
    const manualMaxPoints = Number(lvl.maxPoints || 0);
    if ((correctionText + instructionText).trim().length < 80) {
        return { ...lvl, compactCorrectionSourceHash: sourceHash };
    }

    const prompt = [
        "Tu prépares une fiche compacte de correction DNB HG-EMC pour corriger ensuite des élèves.",
        "Réponds uniquement en JSON strict court. Pas de markdown.",
        "Objectif: réduire le corrigé long en attendus par question et barème probable.",
        manualMaxPoints > 0
            ? `TOTAL IMPOSÉ PAR LE PROF: ${manualMaxPoints} points. Respecte strictement ce total.`
            : "Si le sujet indique un total de points, respecte strictement ce total.",
        "Si le barème question par question n'est pas donné, répartis les points selon la difficulté et le nombre d'éléments attendus.",
        "Ne dépasse jamais le total indiqué.",
        "",
        `Partie: ${lvl.dnbSection || 'docs'}`,
        `Matière: ${lvl.dnbSubject || 'histoire'}`,
        "",
        "SUJET / QUESTIONS:",
        instructionText || "(non fourni)",
        "",
        "CORRIGÉ / AIDE PROF:",
        correctionText || "(non fourni)",
        "",
        "FORMAT JSON:",
        JSON.stringify({
            total_points: manualMaxPoints > 0 ? manualMaxPoints : 8,
            note: "résumé de la logique de correction",
            questions: [
                {
                    numero: "1",
                    max: 3,
                    attendus: ["attendu précis"],
                    valoriser: ["élément à valoriser"],
                    erreurs_frequentes: ["oubli fréquent"]
                }
            ],
            regles: [
                "utiliser toute l'échelle des points",
                "ne pas pénaliser une formulation différente si le sens est correct"
            ]
        })
    ].join('\n');

    try {
        const raw = await AIEngine.ask(prompt, "Tu es un professeur d'histoire-géographie qui fabrique des barèmes compacts DNB. JSON strict uniquement.", {
            route: 'prof-homework',
            feature: 'dnb-compact-correction',
            temperature: 0,
            maxOutputTokens: 1400,
            numPredict: 1400,
            thinkingBudget: 0
        });
        const parsed = AIEngine.sanitizeJSON(raw);
        if (!parsed || !Array.isArray(parsed.questions)) {
            return {
                ...lvl,
                compactCorrectionError: 'Fiche compacte non générée',
                compactCorrectionSourceHash: sourceHash
            };
        }
        const finalMaxPoints = manualMaxPoints > 0
            ? manualMaxPoints
            : (Number(parsed.total_points || lvl.maxPoints || 0) || lvl.maxPoints);
        const compactCorrection = {
            ...parsed,
            total_points: finalMaxPoints || parsed.total_points
        };
        return {
            ...lvl,
            compactCorrection,
            compactCorrectionSourceHash: sourceHash,
            compactCorrectionGeneratedAt: new Date().toISOString(),
            maxPoints: finalMaxPoints
        };
    } catch (e) {
        return {
            ...lvl,
            compactCorrectionError: String(e?.message || e || 'Erreur IA').slice(0, 300),
            compactCorrectionSourceHash: sourceHash
        };
    }
}

/**
 * 📝 BLOC DEVOIRS - ISOLÉ
 * Contient toutes les opérations CRUD pour les devoirs.
 */

router.get('/all', async (req, res) => {
    try { res.json(await Homework.find({}).sort({ date: -1 }).lean()); } 
    catch (e) { res.status(500).json({ error: "DB FAIL" }); }
});

router.get('/submissions', async (req, res) => {
    try {
        const subs = await Submission.find({}, 'studentId homeworkId grade createdAt antiCheat')
            .populate('homeworkId', 'title')
            .lean();
        res.json(subs);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/draft-docs', async (req, res) => {
    try {
        const rows = await HomeworkDraftDoc.find(
            {},
            'studentId homeworkId levelIndex docUrl docId title lastWordCount lastRevisionCount lastRevisionAt updatedAt'
        ).sort({ updatedAt: -1 }).lean();
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/submission/:id', async (req, res) => {
    try {
        const sub = await Submission.findById(req.params.id).lean();
        if (!sub) return res.status(404).json({ error: "Copie introuvable" });
        res.json(sub);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/submission/:id', async (req, res) => {
    try {
        const updated = await Submission.findByIdAndUpdate(
            req.params.id,
            {
                feedback: req.body?.feedback,
                grade: req.body?.grade,
                content: req.body?.content
            },
            { new: true }
        ).lean();
        if (!updated) return res.status(404).json({ error: "Copie introuvable" });
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/remove-punishment', async (req, res) => {
    try {
        const { homeworkId, studentId, classId } = req.body || {};
        await Homework.findByIdAndUpdate(homeworkId, { $pull: { assignedStudents: studentId } });
        const student = await Student.findById(studentId);
        if (!student) return res.status(404).json({ error: 'Élève introuvable' });

        let restoredPoints = 0;
        let restoredScore = null;
        const records = Array.isArray(student.behaviorRecords) ? student.behaviorRecords : [];
        for (let recordIndex = records.length - 1; recordIndex >= 0 && !restoredPoints; recordIndex -= 1) {
            const scores = Array.isArray(records[recordIndex]?.scores) ? records[recordIndex].scores : [];
            for (let scoreIndex = scores.length - 1; scoreIndex >= 0; scoreIndex -= 1) {
                const score = scores[scoreIndex];
                if (!score?.punishment) continue;
                const previous = Number(score.value || 0);
                const penalty = Math.max(0, Number(score.penaltyAmount || 0));
                restoredPoints = Math.min(9, penalty || 9);
                score.value = Math.max(0, Math.min(20, previous + restoredPoints));
                score.penaltyAmount = Math.max(0, penalty - restoredPoints);
                score.punishment = false;
                score.punishmentText = '';
                restoredScore = Number(score.value);
                records[recordIndex].selectedScoreId = String(score.id || score._id || '');
                break;
            }
        }
        student.punishmentStatus = 'NONE';
        student.punishmentDueDate = null;
        student.punishmentLateMailSentAt = null;
        student.punishmentLateMailTo = '';
        student.punishmentLateMailError = '';
        student.markModified('behaviorRecords');
        await student.save();

        if (classId && restoredPoints) {
            const displayName = String(student.nickname || '').trim()
                || `${String(student.firstName || '').trim()} ${String(student.lastName || '').trim().slice(0, 1)}.`.trim();
            const now = new Date();
            const alertId = `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
            const alert = {
                id: alertId,
                message: `Punition faite · ${displayName} +${restoredPoints}`,
                type: 'positive',
                studentId: String(student._id),
                studentName: displayName,
                pointsDelta: restoredPoints,
                score: restoredScore,
                createdAt: now
            };
            await Classroom.updateOne(
                { _id: classId },
                {
                    $set: {
                        activeStudentBonusAlert: alert.message,
                        activeStudentBonusAlertTime: now,
                        scoreAlertReplayId: alertId
                    },
                    $inc: { scoreAlertSyncVersion: 1 },
                    $push: { activeScoreAlerts: { $each: [alert], $slice: -6 } },
                    $pull: { activePersistentDebts: { studentId: String(student._id) } }
                }
            );
        }
        res.json({ ok: true, restoredPoints, score: restoredScore });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
    try {
        const hw = await Homework.findById(req.params.id).lean();
        if (!hw) return res.status(404).json({ error: "Introuvable" });
        res.json(hw);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
    try {
        const data = { ...req.body };
        if (!data._id) delete data._id;
        if (typeof data.isEnabled !== 'boolean') data.isEnabled = true;
        data.assessmentKind = ['', 'dnb', 'rqp', 'commentaire'].includes(String(data.assessmentKind || ''))
            ? String(data.assessmentKind || '')
            : '';
        if (Array.isArray(data.levels)) {
            const allowedDnbSections = new Set(['docs', 'paragraphe', 'reperes', 'emc']);
            const allowedDnbSubjects = new Set(['histoire', 'geo', 'emc']);
            data.levels = data.levels.map((lvl = {}) => {
                const dnbSection = allowedDnbSections.has(String(lvl.dnbSection || '')) ? String(lvl.dnbSection) : 'docs';
                let dnbSubject = allowedDnbSubjects.has(String(lvl.dnbSubject || '')) ? String(lvl.dnbSubject) : 'histoire';
                if (dnbSection === 'emc') dnbSubject = 'emc';
                if (dnbSection !== 'emc' && dnbSubject === 'emc') dnbSubject = 'histoire';
                const maxPoints = Number(lvl.maxPoints || 0);
                return {
                    ...lvl,
                    dnbSection,
                    dnbSubject,
                    maxPoints: Number.isFinite(maxPoints) && maxPoints > 0 ? maxPoints : undefined
                };
            });
            if (data.assessmentKind === 'dnb') {
                data.levels = await Promise.all(data.levels.map((lvl) => generateCompactDnbCorrection(lvl)));
            }
        }
        data.targetClassrooms = [...new Set((data.targetClassrooms || []).map(c => String(c || '').trim().toUpperCase()).filter(Boolean))];
        if (data.isPunishment) {
            data.isAllClass = false;
            data.assignedStudents = [];
        }
        
        const hw = data._id 
            ? await Homework.findByIdAndUpdate(data._id, data, { new: true })
            : await Homework.create(data);
        res.json(hw);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/enabled', async (req, res) => {
    try {
        const isEnabled = req.body?.isEnabled !== false;
        const hw = await Homework.findByIdAndUpdate(
            req.params.id,
            { $set: { isEnabled } },
            { new: true }
        ).lean();
        if (!hw) return res.status(404).json({ error: "Introuvable" });
        res.json(hw);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/upload', upload.array('files'), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "Fichier manquant" });
    }

    try {
        const folderId = await ProfDrive.getOrCreateFolder("CONDA_HOMEWORK_ASSETS");
        const urls = [];

        for (const file of req.files) {
            const driveFile = await ProfDrive.uploadFile(file.originalname, file.path, folderId);
            urls.push(`/api/structure/proxy/${driveFile.id}`);
            try { fs.unlinkSync(file.path); } catch (e) {}
        }

        res.json({ urls });
    } catch (e) {
        res.status(500).json({ error: "Erreur Drive" });
    }
});

// ✅ ROUTE DELETE RESTAURÉE
router.delete('/:id', async (req, res) => {
    try {
        await Homework.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
