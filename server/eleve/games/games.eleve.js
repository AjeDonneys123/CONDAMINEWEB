// @signatures: EleveGamesRouter, list, skins, saveProgress
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const BUILT_IN_GAME_KEYS = ['jumper', 'starship', 'zombie', 'creatures', 'forest', 'guardian'];

/**
 * 🎮 BLOC ÉLÈVE : JEUX & UNIVERS (V99 PROTECTED)
 * REPAIRS:
 * - Strictly enforced isEnabled filtering.
 * - Enforced class name normalization.
 */

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
const academicLevel = (value = '') => (normalizeTargetKey(value).match(/^(6|5|4|3|2|1)/) || [])[1] || '';

// Les jeux natifs React (créatures, forêt, gardien) n'étaient pas des projets
// Studio. Cette route expose donc leur état de visibilité choisi dans Studio.
router.get('/builtin-settings', async (_req, res) => {
    try {
        const StudioProject = mongoose.model('StudioProject');
        const settings = await StudioProject.find({
            title: { $regex: /^__builtin_game__/ },
            isTrashed: { $ne: true }
        }, 'title isProduction updatedAt').sort({ updatedAt: -1 }).lean();
        const enabled = Object.fromEntries(BUILT_IN_GAME_KEYS.map((key) => [key, true]));
        // Le premier élément est le plus récent : ne jamais laisser une ancienne
        // sauvegarde réactiver un jeu qui vient d'être désactivé.
        settings.forEach((setting) => {
            const key = String(setting.title || '').replace('__builtin_game__', '');
            if (Object.prototype.hasOwnProperty.call(enabled, key) && enabled[`__seen_${key}`] !== true) {
                enabled[key] = setting.isProduction !== false;
                enabled[`__seen_${key}`] = true;
            }
        });
        Object.keys(enabled).filter((key) => key.startsWith('__seen_')).forEach((key) => delete enabled[key]);
        res.json(enabled);
    } catch (e) {
        res.json(Object.fromEntries(BUILT_IN_GAME_KEYS.map((key) => [key, true])));
    }
});

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

function normalizeSubjectName(v = '') {
    const raw = String(v || 'GÉNÉRAL').trim().toUpperCase();
    if (raw === 'SS') return 'HISTOIRE GÉOGRAPHIE';
    if (raw === 'HG' || raw === 'HGEO' || raw === 'HIST GEO' || raw === 'HIST-GEO') return 'HISTOIRE GÉOGRAPHIE';
    return raw || 'GÉNÉRAL';
}

// 1. Liste des activités assignées (Filtrée et Sécurisée)
router.get('/list/:studentId', async (req, res) => {
    try {
        // La prévisualisation professeur utilise un identifiant virtuel et non un ObjectId MongoDB.
        // Les jeux intégrés restent disponibles côté client ; il n'y a simplement aucune activité
        // individuelle à charger pour ce visiteur.
        const isVisitor = req.query?.visitor === '1';
        const visitorLevel = academicLevel(req.query?.level);
        if (!isVisitor && !mongoose.Types.ObjectId.isValid(String(req.params.studentId || ''))) {
            return res.json([]);
        }
        const Student = mongoose.model('Student');
        const GameLevel = mongoose.model('GameLevel');
        const Chapter = mongoose.model('Chapter');
        const Teacher = mongoose.model('Teacher');
        const Subject = mongoose.model('Subject');
        
        const student = isVisitor ? { _id: null, currentClass: req.query?.level || '' } : await Student.findById(req.params.studentId).lean();
        if (!student) return res.json([]);

        const classTargets = await buildStudentClassTargets(student);
        const classTargetKeys = new Set(classTargets.map(normalizeTargetKey).filter(Boolean));

        // REQUÊTE SÉCURISÉE : Uniquement ce qui est activé
        const rawGames = await GameLevel.find({
            isTestGame: { $ne: true },
            isEnabled: { $ne: false }, // 🛡️ VERROU ANTI-BROUILLON
            ...(isVisitor ? {} : { $or: [
                { isAllClass: true },
                { assignedStudents: student._id }
            ] })
        }).sort({ createdAt: -1 }).lean();
        let games = rawGames.filter(g => {
            if (isVisitor) return (g.targetClassrooms || []).some((target) => academicLevel(target) === visitorLevel);
            const assigned = (g.assignedStudents || []).some(id => String(id) === String(student._id));
            if (assigned) return true;
            if (!g.isAllClass) return false;
            return matchesClassTargets(g.targetClassrooms, classTargetKeys);
        });

        const normalizeSubject = (v) => normalizeSubjectName(v);

        const chapterIds = [...new Set(games.map(g => g.chapterId ? String(g.chapterId) : null).filter(Boolean))];
        const chapters = chapterIds.length > 0
            ? await Chapter.find({ _id: { $in: chapterIds }, active: { $ne: false } }, '_id title section active').lean()
            : [];
        const activeChapterIds = new Set(chapters.map((chapter) => String(chapter._id)));
        games = games.filter((game) => !game.chapterId || activeChapterIds.has(String(game.chapterId)));
        const chapterSectionById = new Map(chapters.map(ch => [String(ch._id), normalizeSubject(ch.section)]));
        const chapterTitleById = new Map(chapters.map(ch => [String(ch._id), String(ch.title || '')]));

        const teacherIds = [...new Set(games.map(g => g.teacherId ? String(g.teacherId) : null).filter(Boolean))];
        const teachers = teacherIds.length > 0
            ? await Teacher.find({ _id: { $in: teacherIds } }, '_id taughtSubjects subjectSections').lean()
            : [];
        const subjectIds = [...new Set(
            teachers.flatMap(t => (t.taughtSubjects || []).map(s => String(typeof s === 'object' ? s._id : s))).filter(Boolean)
        )];
        const subjects = subjectIds.length > 0
            ? await Subject.find({ _id: { $in: subjectIds } }, '_id name').lean()
            : [];
        const subjectById = new Map(subjects.map(s => [String(s._id), normalizeSubject(s.name)]));

        const teacherPrimaryById = new Map(
            teachers.map(t => {
                const fromTaught = (t.taughtSubjects || [])
                    .map(s => subjectById.get(String(typeof s === 'object' ? s._id : s)))
                    .filter(Boolean);
                const fromSections = (t.subjectSections || [])
                    .map(sec => normalizeSubject(sec.name))
                    .filter(name => name !== 'GÉNÉRAL');
                const primary = fromTaught[0] || fromSections[0] || 'GÉNÉRAL';
                return [String(t._id), primary];
            })
        );

        const resolvedGames = games.map(g => {
            let subject = normalizeSubject(g.subject);
            if (subject === 'GÉNÉRAL') {
                const byChapter = g.chapterId ? chapterSectionById.get(String(g.chapterId)) : null;
                if (byChapter && byChapter !== 'GÉNÉRAL') subject = byChapter;
                else {
                    const byTeacher = g.teacherId ? teacherPrimaryById.get(String(g.teacherId)) : null;
                    if (byTeacher && byTeacher !== 'GÉNÉRAL') subject = byTeacher;
                }
            }
            return { ...g, subject, chapterTitle: g.chapterId ? (chapterTitleById.get(String(g.chapterId)) || '') : '' };
        });

        res.json(resolvedGames);
    } catch (e) { 
        console.error("❌ Error list games:", e.message);
        res.status(500).json([]); 
    }
});

// Projet Studio Tapping accessible directement aux élèves
router.get('/tapping-project', async (req, res) => {
    try {
        const StudioProject = mongoose.model('StudioProject');
        const project = await StudioProject.findOne({
            title: /tapping/i,
            isTrashed: { $ne: true }
        })
            .sort({ isProduction: -1, updatedAt: -1, createdAt: -1 })
            .lean();

        if (!project) return res.json(null);
        res.json(project);
    } catch (e) {
        console.error("❌ Error tapping project:", e.message);
        res.status(500).json(null);
    }
});

// 2. Skins (Projets Studio terminés)
router.get('/skins', async (req, res) => {
    try {
        const studentId = (req.query.studentId || "").toString();
        const StudioProject = mongoose.model('StudioProject');

        // ZOMBIE et Starship sont les habillages officiels des jeux pédagogiques.
        // Ils doivent rester accessibles aux élèves comme au professeur visiteur,
        // même lorsqu'aucun GameLevel classique ne leur est directement assigné.
        const arcadeSkins = await StudioProject.find({
            title: { $regex: /^(ZOMBIE|Starship|Jumper)$/i },
            isTrashed: { $ne: true }
        }, 'title scenes generatedCode')
            .sort({ updatedAt: -1, createdAt: -1 })
            .lean();
        const canonicalByTitle = new Map();
        arcadeSkins.forEach((skin) => {
            const key = String(skin?.title || '').trim().toLowerCase();
            if (key && !canonicalByTitle.has(key)) canonicalByTitle.set(key, skin);
        });
        const canonicalSkins = [...canonicalByTitle.values()].map((skin) => {
            // Jumper dispose d'un moteur local maintenu à part du code BDD.
            // Il doit rester la source élève canonique, comme dans le Studio.
            if (String(skin?.title || '').trim().toLowerCase() !== 'jumper') return skin;
            const localPath = path.join(process.cwd(), 'studio-games', `${skin._id}.js`);
            if (!fs.existsSync(localPath)) return skin;
            return { ...skin, generatedCode: fs.readFileSync(localPath, 'utf8') };
        });

        if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) return res.json(canonicalSkins);

        const Student = mongoose.model('Student');
        const GameLevel = mongoose.model('GameLevel');

        const student = await Student.findById(studentId).lean();
        if (!student) return res.json(canonicalSkins);

        const classTargets = await buildStudentClassTargets(student);
        const classTargetKeys = new Set(classTargets.map(normalizeTargetKey).filter(Boolean));
        const rawAssignedGames = await GameLevel.find({
            isTestGame: { $ne: true },
            isEnabled: { $ne: false },
            $or: [
                { isAllClass: true },
                { assignedStudents: student._id }
            ]
        }, 'title teacherId assignedStudents isAllClass targetClassrooms').lean();
        const assignedGames = rawAssignedGames.filter(g => {
            const assigned = (g.assignedStudents || []).some(id => String(id) === String(student._id));
            if (assigned) return true;
            if (!g.isAllClass) return false;
            return matchesClassTargets(g.targetClassrooms, classTargetKeys);
        });

        const teacherIds = [...new Set(
            assignedGames.map(g => g.teacherId ? String(g.teacherId) : null).filter(Boolean)
        )];
        if (teacherIds.length === 0) return res.json(canonicalSkins);

        const skins = await StudioProject.find({ 
            generatedCode: { $exists: true, $ne: "" },
            isProduction: { $ne: true },
            isTrashed: { $ne: true },
            teacherId: { $in: teacherIds }
        }, 'title scenes generatedCode').sort({ updatedAt: -1 }).lean();
        const merged = new Map(canonicalSkins.map((skin) => [String(skin._id), skin]));
        skins.forEach((skin) => merged.set(String(skin._id), skin));
        res.json([...merged.values()]);
    } catch (e) { res.status(500).json([]); }
});

// 3. Sauvegarde Julian
router.post('/save-progress', async (req, res) => {
    const { studentId, gameId, score, levelReached } = req.body;
    try {
        const safeLevelReached = Math.max(0, Number(levelReached || 0));
        const existing = await mongoose.model('GameProgress').findOne({ studentId, gameId });
        if (existing) {
            await mongoose.model('GameProgress').updateOne(
                { _id: existing._id },
                {
                    lastScore: score,
                    levelReached: Math.max(Number(existing.levelReached || 0), safeLevelReached),
                    updatedAt: new Date()
                }
            );
        } else {
            await mongoose.model('GameProgress').create({
                studentId,
                gameId,
                lastScore: score,
                levelReached: safeLevelReached,
                updatedAt: new Date()
            });
        }
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
