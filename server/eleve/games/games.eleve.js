// @signatures: EleveGamesRouter, list, skins, saveProgress
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

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

// 1. Liste des activités assignées (Filtrée et Sécurisée)
router.get('/list/:studentId', async (req, res) => {
    try {
        const Student = mongoose.model('Student');
        const GameLevel = mongoose.model('GameLevel');
        const Chapter = mongoose.model('Chapter');
        const Teacher = mongoose.model('Teacher');
        const Subject = mongoose.model('Subject');
        
        const student = await Student.findById(req.params.studentId).lean();
        if (!student) return res.json([]);

        const classTargets = await buildStudentClassTargets(student);
        const classTargetKeys = new Set(classTargets.map(normalizeTargetKey).filter(Boolean));

        // REQUÊTE SÉCURISÉE : Uniquement ce qui est activé
        const rawGames = await GameLevel.find({
            isTestGame: { $ne: true },
            isEnabled: { $ne: false }, // 🛡️ VERROU ANTI-BROUILLON
            $or: [
                { isAllClass: true },
                { assignedStudents: student._id }
            ]
        }).sort({ createdAt: -1 }).lean();
        const games = rawGames.filter(g => {
            const assigned = (g.assignedStudents || []).some(id => String(id) === String(student._id));
            if (assigned) return true;
            if (!g.isAllClass) return false;
            return matchesClassTargets(g.targetClassrooms, classTargetKeys);
        });

        const normalizeSubject = (v) => (v || "GÉNÉRAL").toString().trim().toUpperCase();

        const chapterIds = [...new Set(games.map(g => g.chapterId ? String(g.chapterId) : null).filter(Boolean))];
        const chapters = chapterIds.length > 0
            ? await Chapter.find({ _id: { $in: chapterIds } }, '_id section').lean()
            : [];
        const chapterSectionById = new Map(chapters.map(ch => [String(ch._id), normalizeSubject(ch.section)]));

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
            return { ...g, subject };
        });

        res.json(resolvedGames);
    } catch (e) { 
        console.error("❌ Error list games:", e.message);
        res.status(500).json([]); 
    }
});

// 2. Skins (Projets Studio terminés)
router.get('/skins', async (req, res) => {
    try {
        const studentId = (req.query.studentId || "").toString();
        if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) return res.json([]);

        const Student = mongoose.model('Student');
        const GameLevel = mongoose.model('GameLevel');
        const StudioProject = mongoose.model('StudioProject');

        const student = await Student.findById(studentId).lean();
        if (!student) return res.json([]);

        const classTargets = await buildStudentClassTargets(student);
        const classTargetKeys = new Set(classTargets.map(normalizeTargetKey).filter(Boolean));
        const rawAssignedGames = await GameLevel.find({
            isTestGame: { $ne: true },
            isEnabled: { $ne: false },
            $or: [
                { isAllClass: true },
                { assignedStudents: student._id }
            ]
        }, 'teacherId assignedStudents isAllClass targetClassrooms').lean();
        const assignedGames = rawAssignedGames.filter(g => {
            const assigned = (g.assignedStudents || []).some(id => String(id) === String(student._id));
            if (assigned) return true;
            if (!g.isAllClass) return false;
            return matchesClassTargets(g.targetClassrooms, classTargetKeys);
        });

        const teacherIds = [...new Set(
            assignedGames.map(g => g.teacherId ? String(g.teacherId) : null).filter(Boolean)
        )];
        if (teacherIds.length === 0) return res.json([]);

        const skins = await StudioProject.find({ 
            generatedCode: { $exists: true, $ne: "" },
            isProduction: { $ne: true },
            isTrashed: { $ne: true },
            teacherId: { $in: teacherIds }
        }, 'title scenes generatedCode').sort({ updatedAt: -1 }).lean();
        res.json(skins);
    } catch (e) { res.status(500).json([]); }
});

// 3. Sauvegarde Julian
router.post('/save-progress', async (req, res) => {
    const { studentId, gameId, score, levelReached } = req.body;
    try {
        await mongoose.model('GameProgress').findOneAndUpdate(
            { studentId, gameId },
            { lastScore: score, levelReached, updatedAt: new Date() },
            { upsert: true }
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
