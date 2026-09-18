// @signatures: EleveHomework, list, submit
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const EleveAI = require('../core/eleve.ai');
const AIEngine = require('../../core/ai.engine');
const ProfDrive = require('../../prof/core/drive.prof');
const MistakeService = require('../../services/mistake.service');
const { sendLatePunishmentMail, resetLateMailState } = require('../../services/punishmentMailer');
const crypto = require('crypto');
const PUNISHMENT_DUE_MS = 7 * 24 * 60 * 60 * 1000;
const VERIFY_TTL_MS = 2 * 60 * 60 * 1000;
const verifyStore = new Map();

const LOCAL_DNB_PARAGRAPHS = {
    'civilians-ww1-real': {
        title: 'Les civils dans la Première Guerre mondiale',
        instruction: "Dans un développement construit d'une vingtaine de lignes, décrivez et expliquez les souffrances subies par les civils au cours de la Première Guerre mondiale.",
        aiHints: [
            "Sujet officiel: Amérique du Nord — Juin 2019.",
            "Introduction attendue: situation dans le temps (1914-1918) et rappel que le conflit est une guerre totale où l'arrière subit aussi la violence.",
            "Axe 1: souffrances au quotidien à l'arrière: pénuries, rationnement, hausse des prix, dénutrition; deuil massif; angoisse de l'attente; nouvelles du front; censure; mobilisation du travail des femmes, munitionnettes, industrie de guerre et champs.",
            "Axe 2: violences directes: zones occupées/proches du front; réquisitions; travail forcé; bombardements d'artillerie et premiers bombardements aériens; génocide des Arméniens en 1915 par l'Empire ottoman, déportations, massacres systématiques, plus d'un million de victimes civiles.",
            "Conclusion attendue: les civils deviennent des cibles et des acteurs à part entière de la guerre."
        ].join('\n')
    },
    'soldiers-ww1-real': {
        title: 'Les militaires dans la Première Guerre mondiale',
        instruction: "Dans un développement construit d'une vingtaine de lignes, décrivez les conditions de vie des soldats dans les tranchées et montrez la violence des combats.",
        aiHints: [
            "Sujet officiel: Centres Étrangers — Juin 2017.",
            "Introduction attendue: cadre 1914-1918, guerre de position/tranchées à partir de fin 1914, combattants/Poilus.",
            "Axe 1: vie quotidienne dans les tranchées: boue, froid, vermine, poux, rats, manque de sommeil, mauvaise hygiène; peur permanente de la mort; éloignement des proches; rôle du courrier.",
            "Axe 2: violence extrême des combats: artillerie lourde, obus, mitrailleuses, gaz asphyxiants, lance-flammes; exemple Verdun 1916 ou Somme 1916; mortalité massive, traumatismes psychologiques, blessures graves, gueules cassées.",
            "Conclusion attendue: violence de masse subie par une génération entière de soldats."
        ].join('\n')
    },
    'total-war-ww1-real': {
        title: 'La Première Guerre mondiale, une guerre totale',
        instruction: "Dans un développement construit d'une vingtaine de lignes, vous montrerez que la Première Guerre mondiale est une guerre totale qui touche les militaires et les civils.",
        aiHints: [
            "Sujet officiel: Métropole — Juin 2018.",
            "Introduction attendue: définition de la guerre totale, conflit mobilisant l'ensemble des ressources humaines, économiques et culturelles des États.",
            "Axe 1: front et militaires: mobilisation de millions d'hommes y compris des colonies; guerre de tranchées; violence de masse; exemple Verdun.",
            "Axe 2: arrière et civils: reconversion de l'économie vers la guerre; usines d'armement; rôle des femmes; emprunts nationaux; hausse des impôts; pénuries; travail forcé dans les zones occupées; génocide arménien.",
            "Axe 3: mobilisation des esprits: censure; propagande; bourrage de crâne; maintenir le moral; diaboliser l'ennemi.",
            "Conclusion attendue: effacement de la frontière entre combattants et non-combattants de 1914 à 1918."
        ].join('\n')
    }
};

const localDnbHomeworkId = (activityId = '') => new mongoose.Types.ObjectId(
    crypto.createHash('md5').update(`conda-local-dnb-paragraph:${activityId}`).digest('hex').slice(0, 24)
);

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

        const isVisitor = req.query?.visitor === '1';
        const visitorLevel = String(req.query?.level || '').match(/[1-6]/)?.[0] || '';
        const student = isVisitor ? { _id: null, currentClass: req.query?.level || '' } : await Student.findById(req.params.studentId);
        if (!student) return res.json([]);
        if (!isVisitor) await ensurePunishmentState(student, Homework, Submission);

        const classTargets = await buildStudentClassTargets(student);
        const classTargetKeys = new Set(classTargets.map(normalizeTargetKey).filter(Boolean));

        // On cherche les devoirs pour toute la classe OU assignés à Julian
        const rawHomeworks = await Homework.find({
            isEnabled: { $ne: false },
            isPunishment: { $ne: true },
            ...(isVisitor ? {} : { $or: [
                { isAllClass: true, isPunishment: { $ne: true } },
                { assignedStudents: student._id }
            ] })
        }).sort({ date: -1 }).lean();
        const homeworks = rawHomeworks.filter(hw => {
            if (isVisitor) return (hw.targetClassrooms || []).some((target) => String(target || '').match(/[1-6]/)?.[0] === visitorLevel);
            const assigned = (hw.assignedStudents || []).some(id => String(id) === String(student._id));
            if (assigned) return true;
            if (!hw.isAllClass) return false;
            return matchesClassTargets(hw.targetClassrooms, classTargetKeys);
        });

        const chapterIds = [...new Set(homeworks.map((hw) => String(hw.chapterId || '')).filter(Boolean))];
        const chapters = chapterIds.length > 0
            ? await mongoose.model('Chapter').find({ _id: { $in: chapterIds }, active: { $ne: false } }, '_id title section active').lean()
            : [];
        const chapterById = new Map(chapters.map((chapter) => [String(chapter._id), chapter]));

        res.json(homeworks.map((hw) => {
            const chapter = chapterById.get(String(hw.chapterId || ''));
            if (hw.chapterId && !chapter) return null;
            return {
                ...hw,
                chapterTitle: chapter?.title || hw.chapterTitle || '',
                chapterSection: chapter?.section || hw.chapterSection || ''
            };
        }).filter(Boolean));
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

router.get('/submission/:homeworkId/:studentId', async (req, res) => {
    try {
        const Submission = mongoose.model('Submission');
        const { homeworkId, studentId } = req.params;
        if (!homeworkId || !studentId) return res.status(400).json({ error: "Paramètres manquants" });
        if (!mongoose.Types.ObjectId.isValid(studentId) || !mongoose.Types.ObjectId.isValid(homeworkId)) {
            return res.json(null);
        }
        const sub = await Submission.findOne({
            studentId,
            homeworkId
        }).sort({ createdAt: -1 }).lean();
        res.json(sub || null);
    } catch (e) {
        console.error("❌ [ELEVE HW SUBMISSION] error=%s", e.message);
        res.status(500).json({ error: e.message });
    }
});

router.get('/learned/:studentId', async (req, res) => {
    try {
        const Submission = mongoose.model('Submission');
        const studentId = String(req.params.studentId || '');
        if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) return res.json([]);
        const subs = await Submission.find({ studentId })
            .populate('homeworkId', 'title promptTopic assessmentKind mode')
            .sort({ createdAt: -1 })
            .lean();
        
        const learned = subs.filter(s => 
            s.memoSheet || 
            s.draftContent || 
            s.mode === 'redaction' || 
            s.homeworkId?.mode === 'redaction' ||
            s.homeworkId?.assessmentKind === 'rqp' ||
            s.homeworkId?.assessmentKind === 'commentaire'
        ).map(s => ({
            id: s._id,
            homeworkTitle: s.homeworkId?.title || 'Devoir Rédaction',
            promptTopic: s.homeworkId?.promptTopic || '',
            assessmentKind: s.homeworkId?.assessmentKind || 'redaction',
            draftContent: s.draftContent || '',
            aiNotes: s.aiNotes || '',
            memoSheet: s.memoSheet || s.learningEfficiency?.memoSheet || '',
            examBonusPoints: s.examBonusPoints ?? s.learningEfficiency?.examBonusPoints ?? 0,
            examBonusPointsMaxCap: s.learningEfficiency?.examBonusPointsMaxCap || 15.5,
            studentMessage: s.learningEfficiency?.studentMessage || '',
            finalEssay: s.content || '',
            createdAt: s.createdAt
        }));

        res.json(learned);
    } catch (e) {
        console.error('[Learned] Erreur récupération fiches:', e);
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

router.post('/submit-local-dnb-paragraph', async (req, res) => {
    try {
        const activityId = String(req.body?.activityId || '').trim();
        const userText = String(req.body?.userText || '').trim();
        const playerId = String(req.body?.playerId || '').trim();
        const activity = LOCAL_DNB_PARAGRAPHS[activityId];
        if (!activity) return res.status(404).json({ ok: false, error: 'Activité inconnue.' });
        if (!userText) return res.status(400).json({ ok: false, error: 'Réponse vide.' });
        if (!playerId || !mongoose.Types.ObjectId.isValid(playerId)) return res.status(400).json({ ok: false, error: 'Élève invalide.' });

        const Homework = mongoose.model('Homework');
        const Submission = mongoose.model('Submission');
        const Student = mongoose.model('Student');
        const Chapter = mongoose.model('Chapter');
        const student = await Student.findById(playerId, 'currentClass className').lean();
        const studentClass = String(student?.currentClass || student?.className || '').trim();
        const chapter = await Chapter.findOne({
            title: /premi[eè]re guerre mondiale/i,
            section: /hist/i,
            isArchived: { $ne: true }
        }).sort({ updatedAt: -1 }).lean().catch(() => null);

        const homeworkId = localDnbHomeworkId(activityId);
        await Homework.findByIdAndUpdate(
            homeworkId,
            {
                title: activity.title,
                subject: 'HISTOIRE',
                assessmentKind: 'dnb',
                targetClassrooms: studentClass ? [studentClass] : [],
                chapterId: chapter?._id || null,
                levels: [{
                    instruction: activity.instruction,
                    aiHints: activity.aiHints,
                    dnbSection: 'paragraphe',
                    dnbSubject: 'histoire',
                    maxPoints: 20,
                    responseMode: 'text'
                }],
                assignedStudents: [],
                isAllClass: true,
                isEnabled: true
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const analysis = await EleveAI.correctDnbSimple({
            userText,
            instruction: activity.instruction,
            aiHints: activity.aiHints,
            studentClass,
            context: {
                assessmentKind: 'dnb',
                dnbSection: 'paragraphe',
                dnbSubject: 'histoire',
                maxPoints: 20
            }
        });
        const cleanFeedback = stripUnderlinedMarkup(analysis?.feedback_fond || '');
        await Submission.create({
            studentId: playerId,
            homeworkId,
            levelIndex: 0,
            content: userText,
            feedback: cleanFeedback,
            grade: analysis.grade,
            antiCheat: {
                localDnbParagraph: true,
                activityId,
                officialSubject: activity.instruction,
                correctionElements: activity.aiHints
            }
        });
        res.json({ ...analysis, feedback_fond: cleanFeedback, ok: true });
    } catch (error) {
        console.error('submit-local-dnb-paragraph error:', error);
        res.status(500).json({ ok: false, error: error.message || 'Erreur correction IA.' });
    }
});

router.post('/submit', async (req, res) => {
    const {
        userText,
        homeworkId,
        levelIndex,
        playerId,
        antiCheat,
        draftContent,
        aiNotes,
        aiConversationLog,
        timeSpentSeconds,
        attemptsCount,
        attemptsHistory,
        memoSheet,
        sessionToken,
        registeredKeys,
        draftDocMeta
    } = req.body || {};

    const computeSessionToken = (studId, hwId, attNum) => {
        const raw = `${String(studId || '')}_${String(hwId || '')}`;
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
            hash = (hash << 5) - hash + raw.charCodeAt(i);
            hash |= 0;
        }
        const hex = Math.abs(hash).toString(16).toUpperCase().padStart(4, '0').slice(0, 4);
        return `CW-${hex}-T${attNum || 1}`;
    };

    const computeInvisibleWatermark = (studId, hwId) => {
        const raw = `${String(studId || '')}_${String(hwId || '')}`;
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
            hash = (hash << 5) - hash + raw.charCodeAt(i);
            hash |= 0;
        }
        const binary = (Math.abs(hash) & 0xFFFF).toString(2).padStart(16, '0');
        const encoded = binary.split('').map(b => (b === '1' ? '\u200C' : '\u200B')).join('');
        return `\u200D\u200B${encoded}\u200C\u200D`;
    };

    const Homework = mongoose.model('Homework');
    const Submission = mongoose.model('Submission');
    const Student = mongoose.model('Student');

    const hw = await Homework.findById(homeworkId);
    const lvl = (hw.levels && hw.levels[levelIndex]) || { instruction: hw?.promptTopic || '' };
    const compactCorrection = lvl?.compactCorrection && typeof lvl.compactCorrection === 'object'
        ? lvl.compactCorrection
        : null;

    const student = await Student.findById(playerId, 'currentClass').lean();
    const instructionText = hw?.mode === 'redaction'
        ? (hw.promptTopic || lvl?.instruction || 'Rédaction')
        : (lvl?.instruction || '');

    const correctionContext = {
        assessmentKind: hw?.assessmentKind || '',
        dnbSection: lvl?.dnbSection || '',
        dnbSubject: lvl?.dnbSubject || '',
        maxPoints: Number(compactCorrection?.total_points || lvl?.maxPoints || 0) || (hw?.assessmentKind === 'dnb' && lvl?.dnbSection === 'docs' ? 20 : 10),
        hasCompactCorrection: Boolean(compactCorrection)
    };
    const isRedaction = hw?.mode === 'redaction';
    let analysis = { grade: '', feedback_fond: 'Devoir enregistré. Transmis à votre professeur pour correction.' };
    let spellingMistakes = [];

    if (!isRedaction) {
        analysis = String(hw?.assessmentKind || '') === 'dnb'
            ? await EleveAI.correctDnbSimple({
                userText,
                instruction: instructionText,
                aiHints: compactCorrection ? JSON.stringify(compactCorrection) : (lvl?.aiHints || ''),
                studentClass: student?.currentClass || '',
                context: correctionContext
            })
            : await EleveAI.analyze(userText, instructionText, lvl?.aiHints || '', student?.currentClass || '', correctionContext);

        try {
            spellingMistakes = await Promise.race([
                EleveAI.extractSpellingMistakes({
                    userText,
                    instruction: instructionText,
                    studentClass: student?.currentClass || ''
                }),
                new Promise((resolve) => setTimeout(() => resolve([]), 8000))
            ]);
        } catch (e) {
            spellingMistakes = [];
        }
    }
    const cleanFeedback = stripUnderlinedMarkup(analysis?.feedback_fond || '');
    
    const antiCheatSnapshot = sanitizeAntiCheat(antiCheat);
    if (draftDocMeta && typeof draftDocMeta === 'object') {
        antiCheatSnapshot.telemetry = {
            ...(antiCheatSnapshot.telemetry || {}),
            draftDocWordCount: Number(draftDocMeta.wordCount || 0),
            draftDocRevisionCount: Number(draftDocMeta.revisionCount || 0)
        };
    }

    if (hw?.mode === 'redaction') {
        const minTimeSec = (hw.minTimeMinutes || 25) * 60;
        const actualSec = Number(timeSpentSeconds || 0);
        const tooShort = actualSec < minTimeSec;
        antiCheatSnapshot.isRedaction = true;
        antiCheatSnapshot.timeSpentSeconds = actualSec;
        antiCheatSnapshot.minTimeMinutes = hw.minTimeMinutes || 25;
        if (tooShort) {
            antiCheatSnapshot.tooShort = true;
            antiCheatSnapshot.tooShortWarned = true;
            const minsSpent = Math.max(1, Math.round(actualSec / 60));
            antiCheatSnapshot.reasons.unshift(`Temps trop court (${minsSpent} min / min. ${hw.minTimeMinutes || 25} min)`);
            if (antiCheatSnapshot.level === 'GREEN') antiCheatSnapshot.level = 'ORANGE';
        }
        const notesWords = String(aiNotes || '').trim().split(/\s+/).filter(Boolean).length;
        antiCheatSnapshot.aiNotesWordCount = notesWords;
        if (notesWords < 8) {
            antiCheatSnapshot.aiNotesSuspicious = true;
            antiCheatSnapshot.reasons.push(`Notes sur l'IA très faibles (${notesWords} mots)`);
            if (tooShort && antiCheatSnapshot.level !== 'RED') antiCheatSnapshot.level = 'RED';
        }
    }

    let learningEfficiency = null;
    if (hw?.mode === 'redaction' || hw?.assessmentKind === 'rqp' || hw?.assessmentKind === 'commentaire') {
        const history = Array.isArray(attemptsHistory) && attemptsHistory.length > 0 
            ? attemptsHistory 
            : [{ attemptNumber: 1, text: userText }];

        let substantialAttemptsCount = 0;
        const normalizedHistory = history.map((att, idx) => {
            const txt = String(att?.text || '').trim();
            const words = txt.split(/\s+/).filter(Boolean).length;
            const lines = Math.max(txt.split('\n').filter(l => l.trim().length > 0).length, Math.round(words / 9));
            const isSubstantial = lines >= 20 || words >= 150;
            if (isSubstantial) substantialAttemptsCount++;
            return {
                attemptNumber: att?.attemptNumber || (idx + 1),
                text: txt,
                wordsCount: words,
                linesCount: lines,
                isSubstantial
            };
        });

        const attempt1Text = normalizedHistory[0]?.text || '';
        let chatContainsAttempt1 = false;
        if (attempt1Text && aiConversationLog) {
            const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
            const cleanChat = norm(aiConversationLog).slice(0, 3000);
            const cleanAttempt = norm(attempt1Text);
            const words = cleanAttempt.split(' ').filter(w => w.length >= 3);
            if (words.length < 6) {
                chatContainsAttempt1 = cleanChat.includes(cleanAttempt);
            } else {
                for (let i = 0; i <= Math.min(10, words.length - 6); i++) {
                    const phrase = words.slice(i, i + 6).join(' ');
                    if (cleanChat.includes(phrase)) {
                        chatContainsAttempt1 = true;
                        break;
                    }
                }
            }
        }

        const expectedToken = computeSessionToken(playerId, homeworkId, attemptsCount);
        const baseToken = computeSessionToken(playerId, homeworkId, 1);
        const expectedWatermark = computeInvisibleWatermark(playerId, homeworkId);
        const chatString = String(aiConversationLog || '');
        const chatUpper = chatString.toUpperCase();

        const keysToCheck = Array.isArray(registeredKeys) && registeredKeys.length > 0
            ? registeredKeys
            : [sessionToken, expectedToken, baseToken].filter(Boolean);

        const cyrillicMatches = (chatString.match(/[\u0400-\u04FF]/g) || []).length;
        const hasCyrillicWatermark = cyrillicMatches >= 2;

        // Vérification de la présence des clés de collage dans le chat
        const matchedKeys = keysToCheck.filter(k => k && chatUpper.includes(String(k).toUpperCase()));
        const hasEchoTag = chatUpper.includes('CONSEILS_APPLIQU') || chatUpper.includes('CONSEIL_APPLIQU');
        const tokenVerified = matchedKeys.length > 0 || hasEchoTag;

        const watermarkVerified = chatString.includes(expectedWatermark) || hasCyrillicWatermark || tokenVerified;
        const isAuthentic = tokenVerified || watermarkVerified;

        antiCheatSnapshot.cyrillicHomoglyphCount = cyrillicMatches;
        antiCheatSnapshot.hasCyrillicWatermark = hasCyrillicWatermark;

        if (!isAuthentic && chatString.length > 50) {
            antiCheatSnapshot.watermarkMissing = true;
            antiCheatSnapshot.tokenSuspicious = true;
            antiCheatSnapshot.reasons.push("Clés de session CondaWeb introuvables dans l'échange IA.");
            antiCheatSnapshot.level = 'ORANGE';
        }

        const draftWords = String(draftContent || '').trim().split(/\s+/).filter(Boolean).length;
        const aiNotesWords = String(aiNotes || '').trim().split(/\s+/).filter(Boolean).length;

        // Base rules: Brouillon + 1er essai sérieux = socle garanti +0.5 pt
        let examBonusPoints = 0.5;
        let studentMessage = "🏆 Bravo, ton travail maîtrise déjà les attendus de base (+0.5 pt bonus garanti pour ton prochain DS) ! Pour viser l'excellence supérieure (niveau Terminale/Université), va toujours plus loin : ajoute des anecdotes historiques méconnues, cite des auteurs et des chiffres précis pour transformer ta bonne copie en copie remarquable !";
        let teacherSummary = "Devoir réalisé en 1 seul jet direct avec brouillon initial. Bonne maîtrise immédiate (+0.5 pt bonus accordé).";
        let attemptsEvaluation = [
            { attemptNumber: 1, isSubstantial: normalizedHistory[0]?.isSubstantial || false, comment: "Premier essai rédigé avec brouillon initial." }
        ];

        // Audit IA intelligent : appelé si plusieurs essais OU si une discussion avec l'IA est fournie
        if (normalizedHistory.length > 1 || (aiConversationLog && aiConversationLog.trim().length > 30)) {
            try {
                const topicPrompt = hw?.promptTopic || hw?.levels?.[0]?.instruction || hw?.title || 'Sujet de rédaction';
                const attemptsSummary = normalizedHistory.map(a => `=== ESSAI N°${a.attemptNumber} (${a.wordsCount} mots, ~${a.linesCount} lignes) ===\n${a.text}`).join('\n\n');

                const promptToGemini = `Voici le dossier complet de travail d'un élève pour un devoir de type Rédaction / RQP :

SUJET DU DEVOIR :
"${topicPrompt}"

FILIGRANE INVISIBLE CONDAWEB (HOMOGLYPHES CYRILLIQUES e, a, o, c, p) :
- Caractères cyrilliques détectés dans le texte collé : ${cyrillicMatches}
- Principe du filigrane : Tout document ou consigne généré par CondaWeb pour être collé à l'IA intègre un filigrane indétectable pour l'élève constitué d'homoglyphes cyrilliques (lettres russes visuellement identiques : e, a, o, c, p).
- Analyse de copier-coller extérieur :
  * Tout texte généré et copié depuis CondaWeb possède obligatoirement ces caractères cyrilliques.
  * Si l'élève a collé un texte rédigé provenant d'une source externe (ex: un paragraphe complet écrit par ChatGPT sur une autre fenêtre, un extrait de site web, etc.), ce paragraphe externe sera en alphabet purement latin et sera dépourvu de ce filigrane.
  * Les questions et interactions libres écrites manuellement par l'élève ("peux-tu m'expliquer...", "que penses-tu de...") sont en caractères latins normaux et sont 100% autorisées et encouragées.

CLÉS OFFICIELLES GÉNÉRÉES PAR CONDAWEB (à chaque collage de travail pour l'IA) :
Attendues : [${keysToCheck.join(', ')}]
Clés retrouvées dans la discussion collée : [${matchedKeys.join(', ')}]
Statut d'authenticité : ${isAuthentic ? '✅ DOCUMENT CONDAWEB AUTHENTIFIÉ DANS LA DISCUSSION' : '⚠️ AUCUNE CLÉ NI FILIGRANE RETROUVÉS (suspicion de texte généré sur un chat externe sans passer par CondaWeb)'}

BROUILLON / PLAN INITIAL DE L'ÉLÈVE :
${draftContent || '(Aucun brouillon)'}

FICHE MÉMO DU CONTRÔLE SUR TABLE (Plan consolidé & pièges/notions retenus) :
${memoSheet || '(Non complétée)'}

NOTES PRISES PAR L'ÉLÈVE SUR LES RETOURS DE L'IA (tuteur) :
${aiNotes || '(Aucune note)'}

DIFFÉRENTES VERSIONS / ESSAIS DE L'ÉLÈVE (Progression chronologique) :
${attemptsSummary}

ÉCHANGE COMPLET AVEC L'IA (collé par l'élève) :
${aiConversationLog || '(Aucun échange collé)'}

CONSIGNE D'ÉVALUATION ET D'INTÉGRITÉ PÉDAGOGIQUE DU BONUS :
1. ÉVALUATION DE LA PROGRESSION DE L'ÉLÈVE AU FUR ET À MESURE DES VERSIONS :
   - Analyse minutieusement l'évolution entre les versions de l'élève (Essai 1, Essai 2, etc.) et son brouillon.
   - A-t-il tenu compte des retours et conseils donnés par le tuteur IA ?
   - Observe la progression sur la méthode AEI (Affirmer, Expliquer, Illustrer), la clarté de la structure et l'enrichissement des arguments.
2. DÉTECTION D'UN COPIER-COLLER EXTÉRIEUR FRAUDULEUX :
   - Fais la différence entre :
     a) Une CONVERSATION LÉGITIME : l'élève discute de son travail généré sur CondaWeb (présence du filigrane cyrillique et/ou des clés officielles), ou pose des questions spontanées pour mieux comprendre. Cette démarche d'apprentissage est 100% LÉGITIME ET VALORISÉE.
     b) Un COPIER-COLLER EXTÉRIEUR : un bloc rédigé complet (paragraphe de devoir, développement prêt à l'emploi) provenant d'une IA externe ou du web sans le filigrane CondaWeb.
   - Si tu détectes une fraude avérée ou un bloc rédigé copié de l'extérieur sans passer par le travail CondaWeb : bloque le bonus à 0 pt et explique-le avec bienveillance dans studentMessage et teacherSummary.
3. BONUS POUR LE PROCHAIN CONTRÔLE (si intégrité respectée) :
   - Socle de départ garanti : Brouillon initial + Essai 1 sérieux = +0.5 pt.
   - Bonus d'amélioration : accorde jusqu'à +2.5 pts selon la pertinence des conseils appliqués, le progrès réel entre les essais et la qualité de la Fiche Mémo.
4. RÈGLE CRUCIALE POUR LE studentMessage :
   - Explicite clairement au TOUT DÉBUT du message :
     * Soit : "🏆 Niveau très solide (tu maîtrises déjà les attendus, pas de points bonus supplémentaires nécessaires pour ton DS) !"
     * Soit : "📈 Marge de progression détectée (de précieux points bonus à aller chercher pour ton prochain contrôle) !"
   - POUR LES COPIES EXCELLENTES : Ne laisse SURTOUT PAS l'élève perplexe avec un simple 'c'est bien'. Pousse-le activement vers l'excellence supérieure (niveau Terminale / Université) en lui donnant de vraies pistes d'approfondissement : des anecdotes historiques méconnues ou révélatrices, des chiffres et faits précis, des auteurs ou historiens de référence à mentionner, ou des perspectives conceptuelles pointues.
5. Rédige un résumé factuel pour le professeur ("teacherSummary").

Réponds STRICTEMENT par un objet JSON valide suivant ce format :
{
  "examBonusPoints": 1.5,
  "isAuthentic": true,
  "studentMessage": "Ton diagnostic explicite + tes pistes d'excellence ou d'amélioration personnalisées pour l'élève",
  "teacherSummary": "Résumé concis pour le prof sur les versions, l'authenticité de la discussion et les conseils appliqués",
  "attemptsEvaluation": [
    { "attemptNumber": 1, "isSubstantial": true, "comment": "Premier jet sérieux avec plan." }
  ]
}`;

                const rawAiReply = await AIEngine.ask(promptToGemini, "Tu es un évaluateur pédagogique bienveillant et rigoureux. Réponds exclusivement en JSON valide.", { temperature: 0.2 });
                const cleanJson = String(rawAiReply || '').replace(/```json/gi, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(cleanJson);

                if (parsed && typeof parsed === 'object') {
                    const parsedBonus = Number(parsed.examBonusPoints);
                    if (!Number.isNaN(parsedBonus)) {
                        examBonusPoints = Math.min(2.5, Math.max(0, Math.round(parsedBonus * 2) / 2));
                    } else {
                        examBonusPoints = 1.0;
                    }
                    if (parsed.studentMessage) studentMessage = String(parsed.studentMessage).trim();
                    if (parsed.teacherSummary) teacherSummary = String(parsed.teacherSummary).trim();
                    if (Array.isArray(parsed.attemptsEvaluation)) attemptsEvaluation = parsed.attemptsEvaluation;
                }
            } catch (aiErr) {
                console.warn('[Redaction] Échec audit IA Gemini bonus, calcul heuristique de secours:', aiErr?.message || aiErr);
                let fallbackBonus = 0.5;
                if (substantialAttemptsCount >= 2) fallbackBonus += 0.5;
                if (aiNotesWords >= 15) fallbackBonus += 0.5;
                if (memoSheet && memoSheet.trim().length >= 30) fallbackBonus += 0.5;
                examBonusPoints = Math.min(2.5, fallbackBonus);
                studentMessage = `🌟 Superbe persévérance ! Tu remportes +${examBonusPoints} pts bonus pour ton prochain contrôle grâce à tes ${substantialAttemptsCount} essais et tes retours d'apprentissage !`;
            }
        }

        if (!isAuthentic && chatString.length > 50) {
            examBonusPoints = 0;
            studentMessage = "❌ Échec : la clé de session CondaWeb n'a pas été détectée dans l'échange avec l'IA. Veille à copier le prompt officiel et la réponse complète du tuteur.";
            teacherSummary = "Échec d'authenticité : clé de session CondaWeb introuvable dans la discussion IA. Bonus bloqué (0 pt).";
        }

        const draftScore = draftWords >= 60 ? 25 : draftWords >= 30 ? 15 : draftWords >= 10 ? 8 : 0;
        const aiNotesScore = aiNotesWords >= 30 ? 25 : aiNotesWords >= 15 ? 15 : aiNotesWords >= 5 ? 8 : 0;
        const attemptsScore = substantialAttemptsCount >= 2 ? 25 : substantialAttemptsCount === 1 ? 15 : 0;
        const chatMatchScore = chatContainsAttempt1 ? 25 : 0;
        const totalScore = draftScore + aiNotesScore + attemptsScore + chatMatchScore;

        learningEfficiency = {
            score: totalScore,
            scoreOutOf10: (totalScore / 10).toFixed(1),
            examBonusPoints,
            examBonusPointsMaxCap: 15.5,
            studentMessage,
            teacherSummary,
            sessionToken: matchedKeys[0] || keysToCheck[0] || expectedToken,
            matchedKeys,
            generatedKeys: keysToCheck,
            tokenVerified,
            watermarkVerified,
            cyrillicHomoglyphCount: cyrillicMatches,
            hasCyrillicWatermark,
            memoSheet: String(memoSheet || ''),
            substantialAttemptsCount,
            attemptsHistory: normalizedHistory,
            attemptsEvaluation,
            chatContainsAttempt1,
            draftWordCount: draftWords,
            aiNotesWordCount: aiNotesWords,
            breakdown: {
                draftScore,
                aiNotesScore,
                attemptsScore,
                chatMatchScore
            }
        };

        if (!chatContainsAttempt1 && aiConversationLog && aiConversationLog.trim().length > 10) {
            antiCheatSnapshot.reasons.push("Alerte Démarche IA : le texte de l'essai 1 n'a pas été retrouvé au début de l'échange IA (demande directe de rédaction suspectée)");
        }
        if (substantialAttemptsCount === 0) {
            antiCheatSnapshot.reasons.push("Aucune tentative substantielle (moins de 20 lignes)");
        }
    }

    const finalBonus = learningEfficiency?.examBonusPoints ?? 0;

    const existingSub = await Submission.findOne({ studentId: playerId, homeworkId });
    if (existingSub) {
        existingSub.levelIndex = levelIndex || 0;
        existingSub.mode = hw?.mode || 'docs';
        existingSub.content = userText;
        existingSub.draftContent = String(draftContent || '');
        existingSub.aiNotes = String(aiNotes || '');
        existingSub.aiConversationLog = String(aiConversationLog || '');
        existingSub.memoSheet = String(memoSheet || '');
        existingSub.sessionToken = String(sessionToken || '');
        existingSub.timeSpentSeconds = (Number(existingSub.timeSpentSeconds) || 0) + Number(timeSpentSeconds || 0);
        existingSub.attemptsCount = Math.max(Number(existingSub.attemptsCount) || 1, Number(attemptsCount) || 1);
        existingSub.examBonusPoints = Math.max(Number(existingSub.examBonusPoints) || 0, finalBonus);
        existingSub.learningEfficiency = learningEfficiency;
        existingSub.feedback = cleanFeedback;
        existingSub.grade = analysis.grade;
        existingSub.antiCheat = antiCheatSnapshot;
        await existingSub.save();
    } else {
        await Submission.create({ 
            studentId: playerId,
            homeworkId,
            levelIndex: levelIndex || 0,
            mode: hw?.mode || 'docs',
            content: userText,
            draftContent: String(draftContent || ''),
            aiNotes: String(aiNotes || ''),
            aiConversationLog: String(aiConversationLog || ''),
            memoSheet: String(memoSheet || ''),
            sessionToken: String(sessionToken || ''),
            timeSpentSeconds: Number(timeSpentSeconds || 0),
            attemptsCount: Number(attemptsCount || 1),
            examBonusPoints: finalBonus,
            learningEfficiency,
            feedback: cleanFeedback,
            grade: analysis.grade,
            antiCheat: antiCheatSnapshot
        });
    }
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

    res.json({ ...analysis, feedback_fond: cleanFeedback, spellingMistakes, learningEfficiency, examBonusPoints: finalBonus });
});

router.post('/submit-chat', async (req, res) => {
    try {
        const { userText, aiResponse, homeworkId, playerId, antiCheat } = req.body || {};
        const Submission = mongoose.model('Submission');
        const Student = mongoose.model('Student');
        const Homework = mongoose.model('Homework');

        const hid = String(homeworkId || '');
        const sid = String(playerId || '');
        const studentText = String(userText || '').trim();
        const aiText = String(aiResponse || '').trim();

        if (!mongoose.Types.ObjectId.isValid(hid) || !mongoose.Types.ObjectId.isValid(sid)) {
            return res.status(400).json({ error: 'IDs invalides' });
        }
        if (!studentText) return res.status(400).json({ error: "Réponse élève vide." });
        if (!aiText) return res.status(400).json({ error: "Réponse IA vide." });

        const hw = await Homework.findById(hid, 'isPunishment');
        if (!hw) return res.status(404).json({ error: 'Devoir introuvable.' });

        const antiCheatSnapshot = sanitizeAntiCheat(antiCheat);
        await Submission.create({
            studentId: sid,
            homeworkId: hid,
            content: studentText,
            feedback: aiText,
            grade: 'CHAT',
            antiCheat: antiCheatSnapshot
        });

        if (hw?.isPunishment) {
            await Homework.findByIdAndUpdate(hid, { $pull: { assignedStudents: sid } });
            await Student.findByIdAndUpdate(sid, {
                $set: {
                    punishmentStatus: 'NONE',
                    punishmentDueDate: null,
                    punishmentLateMailSentAt: null,
                    punishmentLateMailTo: '',
                    punishmentLateMailError: ''
                }
            });
        }

        return res.json({ ok: true });
    } catch (e) {
        return res.status(500).json({ error: e.message || "Erreur d'enregistrement." });
    }
});

module.exports = router;
