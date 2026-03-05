// @signatures: EleveHomework, list, submit
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const EleveAI = require('../core/eleve.ai');
const ProfDrive = require('../../prof/core/drive.prof');
const MistakeService = require('../../services/mistake.service');
const { sendLatePunishmentMail, resetLateMailState } = require('../../services/punishmentMailer');
const crypto = require('crypto');
const PUNISHMENT_DUE_MS = 7 * 24 * 60 * 60 * 1000;
const VERIFY_TTL_MS = 2 * 60 * 60 * 1000;
const verifyStore = new Map();

const stripUnderlinedMarkup = (html = '') => {
    return String(html || '')
        .replace(/<span[^>]*class=["'][^"']*ai-red-mark[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi, '$1')
        .replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '$1')
        .replace(/ style=["'][^"']*text-decoration\s*:\s*underline[^"']*["']/gi, '');
};

function shuffle(arr = []) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function tokenizeWords(text = '') {
    return [...new Set(
        String(text || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .split(/[^a-z0-9]+/g)
            .map((w) => w.trim())
            .filter((w) => w.length >= 4)
    )];
}

function buildKeywordQcm(expectedKeywords = [], sourceText = '') {
    const sourceWords = tokenizeWords(sourceText);
    const sourceSet = new Set(sourceWords);
    const expected = [...new Set((expectedKeywords || []).map((k) => String(k || '').trim().toLowerCase()).filter(Boolean))];
    const presentExpected = expected.filter((k) => sourceSet.has(k));
    const keywords = [...new Set([...presentExpected, ...sourceWords])].slice(0, 3);
    const wordPool = sourceWords.filter((w) => !keywords.map((k) => k.toLowerCase()).includes(w));
    const fallbackPool = ['contexte', 'idee', 'argument', 'document', 'notion', 'analyse', 'explication', 'cause'];
    const pool = [...new Set([...wordPool, ...fallbackPool])];
    return keywords.slice(0, 3).map((k, idx) => {
        const correct = String(k || '').toLowerCase();
        const distractors = shuffle(pool.filter((w) => w !== correct)).slice(0, 3);
        const options = shuffle([correct, ...distractors]);
        const correctIndex = options.findIndex((o) => o === correct);
        return {
            id: `qcm_${idx + 1}`,
            question: "Quel mot-clé de ta copie est central ?",
            options,
            correctIndex
        };
    }).filter((q) => q.options.length === 4 && q.correctIndex >= 0);
}

function sanitizeAntiCheat(payload = {}) {
    const src = payload && typeof payload === 'object' ? payload : {};
    const score = Math.max(0, Math.min(10, Number(src.score || 0)));
    let level = String(src.level || '').toUpperCase();
    if (!['GREEN', 'ORANGE', 'RED'].includes(level)) {
        if (score >= 8) level = 'RED';
        else if (score >= 4) level = 'ORANGE';
        else level = 'GREEN';
    }
    return {
        score,
        level,
        reasons: Array.isArray(src.reasons) ? src.reasons.map((r) => String(r || '')).filter(Boolean).slice(0, 12) : [],
        flags: {
            pasteBursts: Number(src?.flags?.pasteBursts || 0),
            largeInserts: Number(src?.flags?.largeInserts || 0),
            tabSwitches: Number(src?.flags?.tabSwitches || 0),
            hiddenMs: Number(src?.flags?.hiddenMs || 0),
            oralAIAssist: Number(src?.flags?.oralAIAssist || 0),
            fullscreenExits: Number(src?.flags?.fullscreenExits || 0)
        },
        verification: {
            asked: Boolean(src?.verification?.asked),
            passed: src?.verification?.passed === true,
            confidence: Number(src?.verification?.confidence || 0),
            mode: String(src?.verification?.mode || ''),
            feedback: String(src?.verification?.feedback || ''),
            qcmScore: Number(src?.verification?.qcmScore || 0),
            qcmDurationsMs: Array.isArray(src?.verification?.qcmDurationsMs)
                ? src.verification.qcmDurationsMs.map((x) => Number(x || 0)).slice(0, 6)
                : [],
            transcript: String(src?.verification?.transcript || '').slice(0, 2000),
            responseDurationMs: Number(src?.verification?.responseDurationMs || 0)
        },
        telemetry: {
            requiredDocs: Number(src?.telemetry?.requiredDocs || 0),
            consultedDocs: Number(src?.telemetry?.consultedDocs || 0),
            firstWriteDelayMs: Number(src?.telemetry?.firstWriteDelayMs || 0),
            expectedElapsedMs: Number(src?.telemetry?.expectedElapsedMs || 0),
            actualElapsedMs: Number(src?.telemetry?.actualElapsedMs || 0)
        }
    };
}

function normalizeClassName(v = '') {
    const raw = String(v || '').trim().toUpperCase();
    return { raw, clean: raw.replace(/\s+/g, '') };
}

const buildDraftTitle = ({ student = null, homework = null, levelIndex = 0 }) => {
    const s = student ? `${student.firstName || ''} ${student.lastName || ''}`.trim() : 'Élève';
    const hw = String(homework?.title || 'Devoir').trim();
    return `${hw} - Brouillon ${s} - Q${Number(levelIndex || 0) + 1}`.slice(0, 170);
};

async function ensureDraftDocRecord({ Homework, Student, HomeworkDraftDoc, homeworkId, studentId, levelIndex }) {
    const hid = String(homeworkId || '');
    const sid = String(studentId || '');
    const lIdx = Math.max(0, Number(levelIndex || 0));
    let draft = await HomeworkDraftDoc.findOne({ homeworkId: hid, studentId: sid, levelIndex: lIdx });

    if (draft) {
        try {
            if (draft.docId) await ProfDrive.getGoogleDocStats(draft.docId);
            return draft;
        } catch (e) {
            // Doc cassé/introuvable: on le régénère.
            const msg = String(e?.message || '');
            if (!/404|File not found|notFound/i.test(msg)) throw e;
        }
    }

    const [homework, student] = await Promise.all([
        Homework.findById(hid, 'title'),
        Student.findById(sid, 'firstName lastName')
    ]);
    if (!homework) throw new Error('Devoir introuvable');

    const folderId = await ProfDrive.getOrCreateFolder('CONDA_HOMEWORK_DRAFTS');
    const title = buildDraftTitle({ student, homework, levelIndex: lIdx });
    const doc = await ProfDrive.createGoogleDoc(title, folderId);
    let slides = null;
    try {
        slides = await ProfDrive.createGoogleSlides(`${title} - Slides`, folderId);
    } catch (e) {
        // Slides optionnel: ne pas bloquer le brouillon Google Docs.
        slides = null;
    }

    if (draft) {
        draft.title = title;
        draft.docId = doc.docId;
        draft.docUrl = doc.editUrl;
        draft.docEmbedUrl = doc.embedUrl;
        draft.slidesId = slides?.presentationId || '';
        draft.slidesUrl = slides?.editUrl || '';
        draft.slidesEmbedUrl = slides?.embedUrl || '';
        draft.lastWordCount = 0;
        draft.lastRevisionCount = 0;
        draft.lastRevisionAt = null;
        await draft.save();
        return draft;
    }

    return await HomeworkDraftDoc.create({
        homeworkId: hid,
        studentId: sid,
        levelIndex: lIdx,
        title,
        docId: doc.docId,
        docUrl: doc.editUrl,
        docEmbedUrl: doc.embedUrl,
        slidesId: slides?.presentationId || '',
        slidesUrl: slides?.editUrl || '',
        slidesEmbedUrl: slides?.embedUrl || ''
    });
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
    return (itemTargets || []).some(t => targetKeys.has(normalizeTargetKey(t)));
}

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
        .map(g => String((g && g._id) ? g._id : g))
        .filter(Boolean);
    const groupIds = groupRaw.filter(id => mongoose.Types.ObjectId.isValid(id));
    const groupNames = groupRaw.filter(id => !mongoose.Types.ObjectId.isValid(id));

    if (groupIds.length > 0) {
        const groups = await Classroom.find({ _id: { $in: groupIds } }, 'name').lean();
        groups.forEach(g => addClassTarget(targets, g?.name));
    }
    groupNames.forEach(name => addClassTarget(targets, name));

    const studentId = student?._id ? String(student._id) : '';
    if (Enrollment && studentId && mongoose.Types.ObjectId.isValid(studentId)) {
        const enrollments = await Enrollment.find({ studentId }, 'classId').lean();
        const enrollClassIds = enrollments
            .map(e => String(e?.classId || ''))
            .filter(id => mongoose.Types.ObjectId.isValid(id));
        if (enrollClassIds.length > 0) {
            const enrollClasses = await Classroom.find({ _id: { $in: enrollClassIds } }, 'name').lean();
            enrollClasses.forEach(c => addClassTarget(targets, c?.name));
        }
    }

    return [...targets];
}

async function ensurePunishmentState(student, Homework, Submission) {
    let changed = false;
    const now = Date.now();
    const sid = String(student._id);

    // 1) Si punition active et rendue => on purge
    const activePunishments = await Homework.find({ isPunishment: true, assignedStudents: student._id }, '_id assignedStudents');
    if (activePunishments.length > 0) {
        const sub = await Submission.findOne({
            studentId: student._id,
            homeworkId: { $in: activePunishments.map(h => h._id) }
        }, '_id').lean();
        if (sub && (student.punishmentStatus === 'PENDING' || student.punishmentStatus === 'LATE')) {
            await Homework.updateMany(
                { _id: { $in: activePunishments.map(h => h._id) } },
                { $pull: { assignedStudents: student._id } }
            );
            student.punishmentStatus = 'NONE';
            student.punishmentDueDate = null;
            resetLateMailState(student);
            changed = true;
        }
    }

    // 2) Si pas de punition active, mais >=3 croix chez un prof => auto-assigne
    if (student.punishmentStatus === 'NONE') {
        const { raw, clean } = normalizeClassName(student.currentClass || '');
        const records = (student.behaviorRecords || []).filter(r => Number(r.crosses || 0) >= 3 && r.teacherId);
        for (const rec of records) {
            const punishments = await Homework.find({
                isPunishment: true,
                teacherId: rec.teacherId,
                targetClassrooms: { $in: [raw, clean] }
            }).sort({ updatedAt: -1 });
            const selected = punishments.find(p => {
                const targets = (p.targetClassrooms || []).map(c => String(c || '').trim().toUpperCase());
                return targets.includes(raw) || targets.includes(clean);
            });
            if (!selected) continue;
            const assigned = (selected.assignedStudents || []).some(id => String(id) === sid);
            if (!assigned) {
                selected.assignedStudents = [...(selected.assignedStudents || []), student._id];
                await selected.save();
            }
            student.punishmentStatus = 'PENDING';
            student.punishmentDueDate = new Date(now + PUNISHMENT_DUE_MS);
            resetLateMailState(student);
            changed = true;
            break;
        }
    }

    // 3) Retard si deadline dépassée
    if (student.punishmentStatus === 'PENDING' && student.punishmentDueDate) {
        const dueTs = new Date(student.punishmentDueDate).getTime();
        if (Number.isFinite(dueTs) && dueTs <= now) {
            student.punishmentStatus = 'LATE';
            await sendLatePunishmentMail(student);
            changed = true;
        }
    }
    if (student.punishmentStatus === 'LATE' && !student.punishmentLateMailSentAt) {
        await sendLatePunishmentMail(student);
        changed = true;
    }

    if (changed) await student.save();
}

/**
 * 📝 RÉCUPÉRATION DES DEVOIRS (FIX V101)
 */
router.get('/list/:studentId', async (req, res) => {
    try {
        const Student = mongoose.model('Student');
        const Homework = mongoose.model('Homework');
        const Submission = mongoose.model('Submission');

        const student = await Student.findById(req.params.studentId);
        if (!student) return res.json([]);
        await ensurePunishmentState(student, Homework, Submission);

        const classTargets = await buildStudentClassTargets(student);
        const classTargetKeys = new Set(classTargets.map(normalizeTargetKey).filter(Boolean));

        // On cherche les devoirs pour toute la classe OU assignés à Julian
        const rawHomeworks = await Homework.find({
            isEnabled: { $ne: false },
            $or: [
                { isAllClass: true, isPunishment: { $ne: true } },
                { assignedStudents: student._id }
            ]
        }).sort({ date: -1 }).lean();
        const homeworks = rawHomeworks.filter(hw => {
            const assigned = (hw.assignedStudents || []).some(id => String(id) === String(student._id));
            if (assigned) return true;
            if (!hw.isAllClass) return false;
            return matchesClassTargets(hw.targetClassrooms, classTargetKeys);
        });

        res.json(homeworks);
    } catch (e) {
        console.error("❌ [ELEVE HW LIST] studentId=%s error=%s", req.params.studentId, e.message);
        res.status(500).json([]);
    }
});

router.get('/submissions/:studentId', async (req, res) => {
    try {
        const Submission = mongoose.model('Submission');
        const studentId = String(req.params.studentId || '');
        if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) return res.json([]);
        const subs = await Submission.find(
            { studentId },
            'homeworkId grade createdAt updatedAt'
        ).sort({ createdAt: -1 }).lean();
        res.json(subs);
    } catch (e) {
        res.status(500).json([]);
    }
});

router.get('/mistakes/:studentId', async (req, res) => {
    try {
        const MistakesBook = mongoose.model('MistakesBook');
        const studentId = String(req.params.studentId || '');
        if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) return res.json([]);
        const rows = await MistakesBook.find({ studentId })
            .sort({ date: -1 })
            .limit(300)
            .lean();
        res.json(rows);
    } catch (e) {
        res.status(500).json([]);
    }
});

router.post('/draft-doc/init', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const Student = mongoose.model('Student');
        const HomeworkDraftDoc = mongoose.model('HomeworkDraftDoc');
        const { homeworkId, levelIndex = 0, playerId } = req.body || {};
        const hid = String(homeworkId || '');
        const sid = String(playerId || '');
        const lIdx = Math.max(0, Number(levelIndex || 0));
        if (!mongoose.Types.ObjectId.isValid(hid) || !mongoose.Types.ObjectId.isValid(sid)) {
            return res.status(400).json({ error: 'IDs invalides' });
        }
        const draft = await ensureDraftDocRecord({
            Homework,
            Student,
            HomeworkDraftDoc,
            homeworkId: hid,
            studentId: sid,
            levelIndex: lIdx
        });

        return res.json({
            ok: true,
            draft: {
                docId: draft.docId,
                docUrl: draft.docUrl,
                docEmbedUrl: draft.docEmbedUrl,
                slidesId: draft.slidesId,
                slidesUrl: draft.slidesUrl,
                slidesEmbedUrl: draft.slidesEmbedUrl,
                title: draft.title
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/draft-doc/status', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const Student = mongoose.model('Student');
        const HomeworkDraftDoc = mongoose.model('HomeworkDraftDoc');
        const hid = String(req.query?.homeworkId || '');
        const sid = String(req.query?.playerId || '');
        const lIdx = Math.max(0, Number(req.query?.levelIndex || 0));
        if (!mongoose.Types.ObjectId.isValid(hid) || !mongoose.Types.ObjectId.isValid(sid)) {
            return res.status(400).json({ error: 'IDs invalides' });
        }
        const draft = await ensureDraftDocRecord({
            Homework,
            Student,
            HomeworkDraftDoc,
            homeworkId: hid,
            studentId: sid,
            levelIndex: lIdx
        });

        let stats = {
            wordCount: Number(draft.lastWordCount || 0),
            revisionCount: Number(draft.lastRevisionCount || 0),
            lastRevisionAt: draft.lastRevisionAt || null
        };
        let connected = true;
        let warning = '';
        try {
            const latest = await ProfDrive.getGoogleDocStats(draft.docId);
            stats = {
                wordCount: Number(latest.wordCount || 0),
                revisionCount: Number(latest.revisionCount || 0),
                lastRevisionAt: latest.lastRevisionAt ? new Date(latest.lastRevisionAt) : null
            };
            draft.lastWordCount = stats.wordCount;
            draft.lastRevisionCount = stats.revisionCount;
            draft.lastRevisionAt = stats.lastRevisionAt;
            await draft.save();
        } catch (err) {
            warning = err.message || 'Drive indisponible';
        }

        res.json({
            ok: true,
            connected,
            warning: warning || null,
            draft: {
                docId: draft.docId,
                docUrl: draft.docUrl,
                docEmbedUrl: draft.docEmbedUrl || draft.docUrl,
                slidesId: draft.slidesId || '',
                slidesUrl: draft.slidesUrl || '',
                slidesEmbedUrl: draft.slidesEmbedUrl || draft.slidesUrl || '',
                title: draft.title || ''
            },
            stats
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/draft-doc/sync', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const Student = mongoose.model('Student');
        const HomeworkDraftDoc = mongoose.model('HomeworkDraftDoc');
        const { homeworkId, levelIndex = 0, playerId, text = '' } = req.body || {};
        const hid = String(homeworkId || '');
        const sid = String(playerId || '');
        const lIdx = Math.max(0, Number(levelIndex || 0));
        if (!mongoose.Types.ObjectId.isValid(hid) || !mongoose.Types.ObjectId.isValid(sid)) {
            return res.status(400).json({ error: 'IDs invalides' });
        }
        const draft = await ensureDraftDocRecord({
            Homework,
            Student,
            HomeworkDraftDoc,
            homeworkId: hid,
            studentId: sid,
            levelIndex: lIdx
        });
        const plainText = String(text || '').slice(0, 200000);
        await ProfDrive.replaceGoogleDocContent(draft.docId, plainText);
        let stats = {
            wordCount: Number(draft.lastWordCount || 0),
            revisionCount: Number(draft.lastRevisionCount || 0),
            lastRevisionAt: draft.lastRevisionAt || null
        };
        try {
            const latest = await ProfDrive.getGoogleDocStats(draft.docId);
            stats = {
                wordCount: Number(latest.wordCount || 0),
                revisionCount: Number(latest.revisionCount || 0),
                lastRevisionAt: latest.lastRevisionAt ? new Date(latest.lastRevisionAt) : null
            };
            draft.lastWordCount = stats.wordCount;
            draft.lastRevisionCount = stats.revisionCount;
            draft.lastRevisionAt = stats.lastRevisionAt;
            await draft.save();
        } catch (e) {}
        return res.json({ ok: true, stats, draft: { docUrl: draft.docUrl, title: draft.title } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/anti-cheat/challenge', async (req, res) => {
    try {
        const {
            userText, instruction, playerId, homeworkId, levelIndex,
            cheatFlags = {}, suspicion = {}, docConsultation = {}, writingTrace = {}
        } = req.body || {};
        const baseText = String(userText || '').trim();
        if (!baseText) return res.status(400).json({ error: "Réponse vide" });

        const Student = mongoose.model('Student');
        const student = playerId ? await Student.findById(playerId, 'currentClass').lean() : null;
        const quality = await EleveAI.assessAnswerQuality({
            userText: baseText,
            instruction: instruction || '',
            studentClass: student?.currentClass || ''
        });
        const qScore = Number(quality?.quality_score || 0);
        const levelFit = Number(quality?.level_fit || 0);
        const clientRisk = Number(suspicion?.score || 0);
        const pasteBursts = Number(cheatFlags?.pasteBursts || 0);
        const tabSwitches = Number(cheatFlags?.tabSwitches || 0);
        const hiddenMs = Number(cheatFlags?.hiddenMs || 0);
        const oralAIAssist = Number(cheatFlags?.oralAIAssist || 0);
        const fullscreenExits = Number(cheatFlags?.fullscreenExits || 0);
        const docRequired = Number(docConsultation?.requiredDocs || 0);
        const docConsulted = Number(docConsultation?.consultedDocs || 0);
        const firstWriteDelayMs = Number(writingTrace?.firstWriteDelayMs || 0);
        const answerLen = Number(writingTrace?.answerLen || 0);
        const forcedBySignals =
            pasteBursts > 0 ||
            oralAIAssist > 0 ||
            clientRisk >= 2 ||
            tabSwitches >= 2 ||
            hiddenMs >= 15000 ||
            fullscreenExits > 0 ||
            (docRequired > 0 && docConsulted < docRequired) ||
            (answerLen >= 140 && firstWriteDelayMs <= 6000);
        const shouldAsk = forcedBySignals || (Boolean(quality?.should_ask_security) && qScore >= 0.45 && levelFit >= 0.35);
        if (!shouldAsk) {
            return res.json({
                requireSecurity: false,
                clearSuspicion: true,
                quality: {
                    score: qScore,
                    levelFit,
                    reason: quality?.reason || "Qualité insuffisante: la correction standard est plus pertinente."
                }
            });
        }

        const generated = await EleveAI.generateIntegrityChallenge(instruction || '', baseText, student?.currentClass || '');
        const qcmQuestions = [];
        const openPrompt = String(generated?.question || "En une phrase, explique l'idée principale de ta réponse.");
        const challengeId = crypto.randomUUID();
        const expiresAt = Date.now() + VERIFY_TTL_MS;

        verifyStore.set(challengeId, {
            playerId: String(playerId || ''),
            homeworkId: String(homeworkId || ''),
            levelIndex: Number(levelIndex || 0),
            question: openPrompt,
            qcmQuestions,
            expectedKeywords: Array.isArray(generated?.expected_keywords) ? generated.expected_keywords : [],
            referenceExcerpt: String(generated?.reference_excerpt || ''),
            createdAt: Date.now(),
            expiresAt
        });

        setTimeout(() => verifyStore.delete(challengeId), VERIFY_TTL_MS + 1000);

        res.json({
            requireSecurity: true,
            challengeId,
            question: openPrompt,
            qcmQuestions,
            expiresAt,
            quality: {
                score: qScore,
                levelFit,
                reason: quality?.reason || ''
            }
        });
    } catch (e) {
        res.status(500).json({ error: "Impossible de générer la vérification." });
    }
});

router.post('/anti-cheat/verify', async (req, res) => {
    try {
        const { challengeId, responseText, playerId, qcmAnswers = [], qcmDurationsMs = [], responseMode = 'text', responseDurationMs = 0 } = req.body || {};
        const challenge = verifyStore.get(String(challengeId || ''));
        if (!challenge) return res.status(404).json({ ok: false, error: "Challenge introuvable ou expiré." });
        if (Date.now() > challenge.expiresAt) {
            verifyStore.delete(String(challengeId || ''));
            return res.status(410).json({ ok: false, error: "Temps écoulé." });
        }
        if (challenge.playerId && String(challenge.playerId) !== String(playerId || '')) {
            return res.status(403).json({ ok: false, error: "Challenge invalide pour cet élève." });
        }

        const qcms = Array.isArray(challenge.qcmQuestions) ? challenge.qcmQuestions : [];
        let qcmScore = 0;
        if (qcms.length > 0) {
            let good = 0;
            qcms.forEach((q, i) => {
                const ans = Number((qcmAnswers || [])[i]);
                if (Number.isInteger(ans) && ans === Number(q.correctIndex)) good += 1;
            });
            qcmScore = good / qcms.length;
        }

        const Student = mongoose.model('Student');
        const student = playerId ? await Student.findById(playerId, 'currentClass').lean() : null;
        const verdict = await EleveAI.evaluateIntegrityResponse({
            question: challenge.question,
            expectedKeywords: challenge.expectedKeywords,
            referenceExcerpt: challenge.referenceExcerpt,
            studentResponse: String(responseText || '').trim(),
            studentClass: student?.currentClass || ''
        });

        const openConfidence = Number(verdict?.confidence || 0);
        const openOk = Boolean(verdict?.ok) || openConfidence >= 0.6;
        const ok = (qcms.length === 0 ? true : qcmScore >= 0.5) && (openOk || openConfidence >= 0.5);
        verifyStore.delete(String(challengeId || ''));
        res.json({
            ok,
            confidence: openConfidence,
            feedback: verdict?.feedback || '',
            qcmScore,
            monitoring: {
                qcmDurationsMs: Array.isArray(qcmDurationsMs) ? qcmDurationsMs.map((x) => Number(x || 0)).slice(0, 6) : [],
                responseMode: String(responseMode || 'text'),
                responseDurationMs: Number(responseDurationMs || 0)
            }
        });
    } catch (e) {
        res.status(500).json({ ok: false, error: "Erreur de vérification." });
    }
});

router.post('/submit', async (req, res) => {
    const { userText, homeworkId, levelIndex, playerId, antiCheat, draftDocMeta } = req.body;
    const Homework = mongoose.model('Homework');
    const Submission = mongoose.model('Submission');
    const Student = mongoose.model('Student');

    const hw = await Homework.findById(homeworkId);
    const lvl = hw.levels[levelIndex];

    const student = await Student.findById(playerId, 'currentClass').lean();
    const analysis = await EleveAI.analyze(userText, lvl.instruction, lvl.aiHints, student?.currentClass || '');
    const spellingMistakes = await EleveAI.extractSpellingMistakes({
        userText,
        instruction: lvl?.instruction || '',
        studentClass: student?.currentClass || ''
    });
    const cleanFeedback = stripUnderlinedMarkup(analysis?.feedback_fond || '');
    
    const antiCheatSnapshot = sanitizeAntiCheat(antiCheat);
    if (draftDocMeta && typeof draftDocMeta === 'object') {
        antiCheatSnapshot.telemetry = {
            ...(antiCheatSnapshot.telemetry || {}),
            draftDocWordCount: Number(draftDocMeta.wordCount || 0),
            draftDocRevisionCount: Number(draftDocMeta.revisionCount || 0)
        };
    }
    await Submission.create({ 
        studentId: playerId, homeworkId, levelIndex, 
        content: userText, feedback: cleanFeedback, grade: analysis.grade,
        antiCheat: antiCheatSnapshot
    });
    await MistakeService.recordForStudent({
        studentId: playerId,
        mistakes: spellingMistakes,
        sourceType: 'homework',
        sourceRef: `${homeworkId}:${levelIndex}`,
        context: String(lvl?.instruction || '').slice(0, 300)
    });

    if (hw?.isPunishment) {
        await Homework.findByIdAndUpdate(homeworkId, { $pull: { assignedStudents: playerId } });
        await Student.findByIdAndUpdate(playerId, {
            $set: {
                punishmentStatus: 'NONE',
                punishmentDueDate: null,
                punishmentLateMailSentAt: null,
                punishmentLateMailTo: '',
                punishmentLateMailError: ''
            }
        });
    }

    res.json({ ...analysis, feedback_fond: cleanFeedback, spellingMistakes });
});

module.exports = router;
