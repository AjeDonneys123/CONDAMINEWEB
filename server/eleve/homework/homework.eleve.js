// @signatures: EleveHomework, list, submit
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const EleveAI = require('../core/eleve.ai');
const { sendLatePunishmentMail, resetLateMailState } = require('../../services/punishmentMailer');
// MODE TEST: 1 minute. Basculer plus tard à 7 jours.
const PUNISHMENT_DUE_MS = 60 * 1000;

function normalizeClassName(v = '') {
    const raw = String(v || '').trim().toUpperCase();
    return { raw, clean: raw.replace(/\s+/g, '') };
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

        const myClass = (student.currentClass || "").trim().toUpperCase();
        const myClassClean = myClass.replace(/\s+/g, '');

        // On cherche les devoirs pour toute la classe OU assignés à Julian
        const homeworks = await Homework.find({
            $or: [
                { targetClassrooms: { $in: [myClass, myClassClean] }, isAllClass: true, isPunishment: { $ne: true } },
                { assignedStudents: student._id }
            ]
        }).sort({ date: -1 }).lean();

        res.json(homeworks);
    } catch (e) {
        res.status(500).json([]);
    }
});

router.post('/submit', async (req, res) => {
    const { userText, homeworkId, levelIndex, playerId } = req.body;
    const Homework = mongoose.model('Homework');
    const Submission = mongoose.model('Submission');
    const Student = mongoose.model('Student');

    const hw = await Homework.findById(homeworkId);
    const lvl = hw.levels[levelIndex];

    const analysis = await EleveAI.analyze(userText, lvl.instruction, lvl.aiHints);
    
    await Submission.create({ 
        studentId: playerId, homeworkId, levelIndex, 
        content: userText, feedback: analysis.feedback_fond, grade: analysis.grade 
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

    res.json(analysis);
});

module.exports = router;
