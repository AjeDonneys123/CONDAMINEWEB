// @signatures: EleveClassroom, status
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const CROSS_DECAY_MS = 14 * 24 * 60 * 60 * 1000;

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

function applyCrossDecay(behaviorRecords = []) {
    const now = Date.now();
    let changed = false;
    for (const r of behaviorRecords) {
        let crosses = Number(r.crosses || 0);
        let nextTs = r.nextCrossRemovalAt ? new Date(r.nextCrossRemovalAt).getTime() : null;

        if (crosses <= 0) {
            if (r.crosses !== 0) { r.crosses = 0; changed = true; }
            if (r.nextCrossRemovalAt) { r.nextCrossRemovalAt = null; changed = true; }
            continue;
        }

        if (!nextTs || Number.isNaN(nextTs)) {
            nextTs = now + CROSS_DECAY_MS;
            r.nextCrossRemovalAt = new Date(nextTs);
            changed = true;
        }

        while (crosses > 0 && nextTs <= now) {
            crosses -= 1;
            changed = true;
            if (crosses > 0) nextTs += CROSS_DECAY_MS;
        }

        if (crosses !== Number(r.crosses || 0)) {
            r.crosses = crosses;
            changed = true;
        }

        if (crosses <= 0) {
            if (r.nextCrossRemovalAt) { r.nextCrossRemovalAt = null; changed = true; }
        } else {
            const currentTs = r.nextCrossRemovalAt ? new Date(r.nextCrossRemovalAt).getTime() : null;
            if (currentTs !== nextTs) {
                r.nextCrossRemovalAt = new Date(nextTs);
                changed = true;
            }
        }
    }
    return changed;
}

function normalizeSubjectName(v = '') {
    const raw = String(v || 'GÉNÉRAL').trim().toUpperCase();
    if (raw === 'SS') return 'HISTOIRE GÉOGRAPHIE';
    if (raw === 'HG' || raw === 'HGEO' || raw === 'HIST GEO' || raw === 'HIST-GEO') return 'HISTOIRE GÉOGRAPHIE';
    return raw || 'GÉNÉRAL';
}

router.get('/status/:studentId', async (req, res) => {
    const Student = mongoose.model('Student');
    const student = await Student.findById(req.params.studentId, 'behaviorRecords currentClass seatX seatY');
    if (!student) return res.json(null);
    if (applyCrossDecay(student.behaviorRecords || [])) {
        student.markModified('behaviorRecords');
        await student.save();
    }
    res.json(student.toObject());
});

router.get('/status-summary/:studentId', async (req, res) => {
    try {
        const Student = mongoose.model('Student');
        const Teacher = mongoose.model('Teacher');
        const Subject = mongoose.model('Subject');
        const Homework = mongoose.model('Homework');
        const GameLevel = mongoose.model('GameLevel');
        const LearningModule = mongoose.model('LearningModule');
        const Expose = mongoose.model('Expose');
        const Lecture = mongoose.model('Lecture');
        const CommentActivity = mongoose.model('CommentActivity');
        const Production = mongoose.model('Production');
        const Chapter = mongoose.model('Chapter');
        const Submission = mongoose.model('Submission');
        const GameProgress = mongoose.model('GameProgress');
        const Enrollment = mongoose.models.Enrollment ? mongoose.model('Enrollment') : null;

        const studentDoc = await Student.findById(req.params.studentId, '_id currentClass classId assignedGroups behaviorRecords');
        if (!studentDoc) return res.json({ disciplines: [] });
        if (applyCrossDecay(studentDoc.behaviorRecords || [])) {
            studentDoc.markModified('behaviorRecords');
            await studentDoc.save();
        }
        const student = studentDoc.toObject();
        const StudioProject = mongoose.model('StudioProject');
        const tappingProject = await StudioProject.findOne({
            title: /tapping/i,
            isTrashed: { $ne: true }
        }, '_id title')
            .sort({ isProduction: -1, updatedAt: -1, createdAt: -1 })
            .lean();

        const totalCrosses = (student.behaviorRecords || [])
            .reduce((sum, record) => sum + Number(record?.crosses || 0), 0);
        const totalBonuses = (student.behaviorRecords || [])
            .reduce((sum, record) => sum + Number(record?.bonuses || 0), 0);

        const classTargets = await buildStudentClassTargets(studentDoc);
        const classTargetKeys = new Set(classTargets.map(normalizeTargetKey).filter(Boolean));
        const classScopeIds = []
            .concat(student.classId ? [student.classId] : [])
            .concat((student.assignedGroups || []).map(g => (typeof g === 'object' ? g._id : g)).filter(Boolean));
        if (Enrollment && student?._id) {
            const enrollments = await Enrollment.find({ studentId: student._id }, 'classId').lean();
            enrollments.forEach(e => {
                if (e?.classId) classScopeIds.push(e.classId);
            });
        }

        const teachers = await Teacher.find(
            classScopeIds.length > 0 ? { assignedClasses: { $in: classScopeIds } } : { _id: null },
            '_id firstName lastName taughtSubjects subjectSections'
        ).lean();

        const subjectIds = [...new Set(
            teachers.flatMap(t => (t.taughtSubjects || []).map(s => String(typeof s === 'object' ? s._id : s))).filter(Boolean)
        )];
        const subjectRows = subjectIds.length > 0
            ? await Subject.find({ _id: { $in: subjectIds } }, '_id name').lean()
            : [];
        const subjectById = new Map(subjectRows.map(s => [String(s._id), (s.name || '').toUpperCase()]));

        const normalizeSubject = (v) => normalizeSubjectName(v);
        const getTeacherSubjects = (teacher) => {
            const fromTaught = (teacher.taughtSubjects || [])
                .map(s => subjectById.get(String(typeof s === 'object' ? s._id : s)))
                .filter(Boolean);
            if (fromTaught.length > 0) return [...new Set(fromTaught)];

            const fromSections = (teacher.subjectSections || [])
                .map(s => normalizeSubject(s.name))
                .filter(name => name !== 'GÉNÉRAL');
            if (fromSections.length > 0) return [...new Set(fromSections)];

            return ['GÉNÉRAL'];
        };
        const getTeacherPrimarySubject = (teacher) => {
            const subjects = getTeacherSubjects(teacher).filter(s => s !== 'GÉNÉRAL');
            if (subjects.length > 0) return subjects[0];
            return 'GÉNÉRAL';
        };
        const sectionParentByName = new Map();
        for (const teacher of teachers) {
            const parent = getTeacherPrimarySubject(teacher);
            if (parent === 'GÉNÉRAL') continue;
            for (const sec of (teacher.subjectSections || [])) {
                const secName = normalizeSubject(sec?.name);
                if (!secName || secName === 'GÉNÉRAL') continue;
                sectionParentByName.set(secName, parent);
            }
        }
        const mapToParentDiscipline = (name) => {
            const normalized = normalizeSubject(name);
            return sectionParentByName.get(normalized) || normalized;
        };

        const disciplineMap = new Map();
        const ensureDiscipline = (subject, fallbackTeachers = []) => {
            if (!disciplineMap.has(subject)) {
                disciplineMap.set(subject, {
                    subject,
                    teachers: [...new Set(fallbackTeachers.filter(Boolean))],
                    crosses: 0,
                    bonuses: 0,
                    homework: { total: 0, done: 0, todo: 0, todoTitles: [] },
                    games: { total: 0, done: 0, started: 0, todo: 0, todoTitles: [] },
                    activities: { total: 0, done: 0, todo: 0, todoTitles: [], todoItems: [], savedItems: [] }
                });
            }
            return disciplineMap.get(subject);
        };
        const behaviorByTeacher = new Map(
            (student.behaviorRecords || [])
                .filter(r => r.teacherId)
                .map(r => [String(r.teacherId), r])
        );

        for (const teacher of teachers) {
            const teacherId = String(teacher._id);
            const teacherName = `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim() || 'Professeur';
            const record = behaviorByTeacher.get(teacherId) || { crosses: 0, bonuses: 0 };
            const subject = getTeacherPrimarySubject(teacher);
            if (subject === 'GÉNÉRAL') continue;
            const entry = ensureDiscipline(subject);
            if (!entry.teachers.includes(teacherName)) entry.teachers.push(teacherName);
            entry.crosses += Number(record.crosses || 0);
            entry.bonuses += Number(record.bonuses || 0);
        }

        if (tappingProject) {
            const entry = ensureDiscipline('JEUX');
            entry.crosses = Math.max(Number(entry.crosses || 0), totalCrosses);
            entry.bonuses = Math.max(Number(entry.bonuses || 0), totalBonuses);
            entry.games.total += 1;
            entry.games.todo += 1;
            entry.games.todoTitles.push('Tapping');
            entry.activities.total += 1;
            entry.activities.todo += 1;
            entry.activities.todoTitles.push('🎮 Tapping');
            entry.activities.todoItems.push({
                id: String(tappingProject._id),
                type: 'game',
                title: 'Tapping',
                label: '🎮 Tapping'
            });
        }

        const homeworks = [];

        const rawGames = await GameLevel.find({
            isTestGame: { $ne: true },
            isEnabled: { $ne: false },
            $or: [
                { isAllClass: true },
                { assignedStudents: student._id },
                { title: /tapping/i }
            ]
        }, '_id title subject chapterId teacherId assignedStudents isAllClass targetClassrooms').lean();
        const games = rawGames.filter(game => {
            const assigned = (game.assignedStudents || []).some(id => String(id) === String(student._id));
            if (assigned) return true;
            if (/tapping/i.test(String(game?.title || ''))) return true;
            if (!game.isAllClass) return false;
            return matchesClassTargets(game.targetClassrooms, classTargetKeys);
        });
        const rawLearningModules = await LearningModule.find({
            isEnabled: { $ne: false },
            $or: [
                { isAllClass: true },
                { assignedStudents: student._id }
            ]
        }, '_id title subject chapterId teacherId targetClassrooms assignedStudents isAllClass completions').lean();
        const learningModules = rawLearningModules.filter(m => {
            const assigned = (m.assignedStudents || []).some(id => String(id) === String(student._id));
            if (assigned) return true;
            if (!m.isAllClass) return false;
            return matchesClassTargets(m.targetClassrooms, classTargetKeys);
        });
        const exposes = [];
        const lectures = [];
        const comments = [];
        const productions = [];

        const chapterIds = [...new Set(
            [...homeworks, ...games, ...learningModules, ...exposes, ...lectures, ...comments, ...productions]
                .map(it => it.chapterId ? String(it.chapterId) : null)
                .filter(Boolean)
        )];
        const chapterRows = chapterIds.length > 0
            ? await Chapter.find({ _id: { $in: chapterIds } }, '_id section').lean()
            : [];
        const chapterSectionById = new Map(
            chapterRows.map(ch => [String(ch._id), normalizeSubject(ch.section)])
        );
        const teacherPrimaryById = new Map(
            teachers.map(t => [String(t._id), getTeacherPrimarySubject(t)])
        );
        const resolveItemSubject = (item) => {
            const raw = mapToParentDiscipline(item.subject);
            if (raw !== 'GÉNÉRAL') return raw;
            const byChapter = item.chapterId ? chapterSectionById.get(String(item.chapterId)) : null;
            const chapterMapped = byChapter ? mapToParentDiscipline(byChapter) : null;
            if (chapterMapped && chapterMapped !== 'GÉNÉRAL') return chapterMapped;
            const byTeacher = item.teacherId ? teacherPrimaryById.get(String(item.teacherId)) : null;
            if (byTeacher && byTeacher !== 'GÉNÉRAL') return byTeacher;
            if (disciplineMap.size === 1) return [...disciplineMap.keys()][0];
            return null;
        };

        const submissions = await Submission.find({ studentId: student._id }, 'homeworkId').lean();
        const progressRows = await GameProgress.find({ studentId: student._id }, 'gameId levelReached').lean();
        const submittedHomeworkIds = new Set(submissions.map(s => String(s.homeworkId)));
        const progressByGameId = new Map(progressRows.map(p => [String(p.gameId), Number(p.levelReached || 0)]));
        for (const hw of homeworks) {
            const fallbackSubject = mapToParentDiscipline(hw.subject || 'GÉNÉRAL');
            const subject = resolveItemSubject(hw) || fallbackSubject || 'GÉNÉRAL';
            const entry = ensureDiscipline(subject);
            const done = submittedHomeworkIds.has(String(hw._id));
            entry.homework.total += 1;
            entry.activities.total += 1;
            if (done) {
                entry.homework.done += 1;
            } else {
                entry.homework.todo += 1;
                entry.homework.todoTitles.push(hw.title || 'Devoir');
            }
            if (done) {
                entry.activities.done += 1;
                entry.activities.savedItems.push({
                    id: String(hw._id),
                    type: 'homework',
                    title: hw.title || 'Devoir',
                    label: `📚 Refaire ${hw.title || 'Devoir'}`
                });
            } else {
                entry.activities.todo += 1;
                entry.activities.todoTitles.push(`📚 ${hw.title || 'Devoir'}`);
                entry.activities.todoItems.push({
                    id: String(hw._id),
                    type: 'homework',
                    title: hw.title || 'Devoir',
                    label: `📚 ${hw.title || 'Devoir'}`
                });
            }
        }

        for (const game of games) {
            const fallbackSubject = mapToParentDiscipline(game.subject || 'GÉNÉRAL');
            const subject = resolveItemSubject(game) || fallbackSubject || 'GÉNÉRAL';
            const entry = ensureDiscipline(subject);
            const levelReached = progressByGameId.get(String(game._id));
            entry.games.total += 1;
            entry.activities.total += 1;
            if (levelReached === undefined) {
                entry.games.todo += 1;
                entry.games.todoTitles.push(game.title || 'Jeu');
                entry.activities.todo += 1;
                entry.activities.todoTitles.push(`🎮 ${game.title || 'Jeu'}`);
                entry.activities.todoItems.push({
                    id: String(game._id),
                    type: 'game',
                    title: game.title || 'Jeu',
                    label: `🎮 ${game.title || 'Jeu'}`
                });
            } else if (levelReached >= 1) {
                entry.games.done += 1;
                entry.activities.done += 1;
                entry.activities.savedItems.push({
                    id: String(game._id),
                    type: 'game',
                    title: game.title || 'Jeu',
                    label: `🎮 Refaire ${game.title || 'Jeu'}`
                });
            } else {
                entry.games.started += 1;
                entry.activities.done += 1;
                entry.activities.savedItems.push({
                    id: String(game._id),
                    type: 'game',
                    title: game.title || 'Jeu',
                    label: `🎮 Reprendre ${game.title || 'Jeu'}`
                });
            }
        }

        for (const m of learningModules) {
            const fallbackSubject = mapToParentDiscipline(m.subject || 'GÉNÉRAL');
            const subject = resolveItemSubject(m) || fallbackSubject || 'GÉNÉRAL';
            const entry = ensureDiscipline(subject);
            const completion = (m.completions || []).find((c) => String(c.studentId) === String(student._id));
            const done = Boolean(completion?.completedAt);
            entry.activities.total += 1;
            if (done) {
                entry.activities.done += 1;
                entry.activities.savedItems.push({
                    id: String(m._id),
                    type: 'learning',
                    title: m.title || 'Apprentissage',
                    label: `🧠 Refaire ${m.title || 'Apprentissage'}`
                });
            } else {
                entry.activities.todo += 1;
                entry.activities.todoTitles.push(`🧠 ${m.title || 'Apprentissage'}`);
                entry.activities.todoItems.push({
                    id: String(m._id),
                    type: 'learning',
                    title: m.title || 'Apprentissage',
                    label: `🧠 ${m.title || 'Apprentissage'}`
                });
            }
        }

        for (const ex of exposes) {
            const fallbackSubject = mapToParentDiscipline(ex.subject || 'GÉNÉRAL');
            const subject = resolveItemSubject(ex) || fallbackSubject || 'GÉNÉRAL';
            const entry = ensureDiscipline(subject);
            const submission = (ex.presentations || []).find((p) => String(p.studentId) === String(student._id));
            const done = Boolean(submission?.updatedAt);
            entry.activities.total += 1;
            if (done) {
                entry.activities.done += 1;
                entry.activities.savedItems.push({
                    id: String(ex._id),
                    type: 'expose',
                    title: ex.title || 'Exposé',
                    label: `🗣️ Refaire ${ex.title || 'Exposé'}`
                });
            } else {
                entry.activities.todo += 1;
                entry.activities.todoTitles.push(`🗣️ ${ex.title || 'Exposé'}`);
                entry.activities.todoItems.push({
                    id: String(ex._id),
                    type: 'expose',
                    title: ex.title || 'Exposé',
                    label: `🗣️ ${ex.title || 'Exposé'}`
                });
            }
        }

        for (const lec of lectures) {
            const fallbackSubject = mapToParentDiscipline(lec.subject || 'GÉNÉRAL');
            const subject = resolveItemSubject(lec) || fallbackSubject || 'GÉNÉRAL';
            const entry = ensureDiscipline(subject);
            const submission = (lec.submissions || []).find((p) => String(p.studentId) === String(student._id));
            const done = Boolean(submission?.completedAt);
            entry.activities.total += 1;
            if (done) {
                entry.activities.done += 1;
                entry.activities.savedItems.push({
                    id: String(lec._id),
                    type: 'lecture',
                    title: lec.title || 'Lecture',
                    label: `📖 Refaire ${lec.title || 'Lecture'}`
                });
            } else {
                entry.activities.todo += 1;
                entry.activities.todoTitles.push(`📖 ${lec.title || 'Lecture'}`);
                entry.activities.todoItems.push({
                    id: String(lec._id),
                    type: 'lecture',
                    title: lec.title || 'Lecture',
                    label: `📖 ${lec.title || 'Lecture'}`
                });
            }
        }

        for (const com of comments) {
            const fallbackSubject = mapToParentDiscipline(com.subject || 'GÉNÉRAL');
            const subject = resolveItemSubject(com) || fallbackSubject || 'GÉNÉRAL';
            const entry = ensureDiscipline(subject);
            const submission = (com.submissions || []).find((p) => String(p.studentId) === String(student._id));
            const done = Boolean(submission?.completedAt);
            entry.activities.total += 1;
            if (done) {
                entry.activities.done += 1;
                entry.activities.savedItems.push({
                    id: String(com._id),
                    type: 'comment',
                    title: com.title || 'Commentaire',
                    label: `🧾 Refaire ${com.title || 'Commentaire'}`
                });
            } else {
                entry.activities.todo += 1;
                entry.activities.todoTitles.push(`🧾 ${com.title || 'Commentaire'}`);
                entry.activities.todoItems.push({
                    id: String(com._id),
                    type: 'comment',
                    title: com.title || 'Commentaire',
                    label: `🧾 ${com.title || 'Commentaire'}`
                });
            }
        }

        for (const prod of productions) {
            const fallbackSubject = mapToParentDiscipline(prod.subject || 'GÉNÉRAL');
            const subject = resolveItemSubject(prod) || fallbackSubject || 'GÉNÉRAL';
            const entry = ensureDiscipline(subject);
            const submission = (prod.submissions || []).find((p) => String(p.studentId) === String(student._id));
            const done = Boolean(submission?.completedAt);
            const icon = prod.productionType === 'qcm' ? '🎮' : (prod.productionType === 'questionnaire' ? '🎙️' : '🏗️');
            entry.activities.total += 1;
            if (done) {
                entry.activities.done += 1;
                entry.activities.savedItems.push({
                    id: String(prod._id),
                    type: 'production',
                    title: prod.title || 'Production',
                    label: `${icon} Refaire ${prod.title || 'Production'}`
                });
            } else {
                entry.activities.todo += 1;
                entry.activities.todoTitles.push(`${icon} ${prod.title || 'Production'}`);
                entry.activities.todoItems.push({
                    id: String(prod._id),
                    type: 'production',
                    title: prod.title || 'Production',
                    label: `${icon} ${prod.title || 'Production'}`
                });
            }
        }

        const disciplines = [...disciplineMap.values()]
            .filter((entry) => Number(entry?.activities?.total || 0) > 0)
            .sort((a, b) => a.subject.localeCompare(b.subject, 'fr'));
        res.json({ disciplines });
    } catch (e) {
        res.status(500).json({ disciplines: [], error: e.message });
    }
});

module.exports = router;
