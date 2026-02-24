// @signatures: EleveAuth, login, freshData
const express = require('express');
const router = express.Router();
const { Student } = require('../models/eleve.models');
const { sendLatePunishmentMail, resetLateMailState } = require('../../services/punishmentMailer');
const CROSS_DECAY_MS = 14 * 24 * 60 * 60 * 1000;
// MODE TEST: 1 minute. Basculer plus tard à 7 jours.
const PUNISHMENT_DUE_MS = 60 * 1000;

function normalizeClassName(v = '') {
    const raw = String(v || '').trim().toUpperCase();
    return { raw, clean: raw.replace(/\s+/g, '') };
}

async function syncPunishmentState(student) {
    const Homework = require('../../prof/models/prof.models').Homework;
    const Submission = require('../../prof/models/prof.models').Submission;
    let changed = false;
    const now = Date.now();

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

    const activePunishments = await Homework.find({ isPunishment: true, assignedStudents: student._id }, '_id').lean();
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
            const assigned = (selected.assignedStudents || []).some(id => String(id) === String(student._id));
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

    return changed;
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

/**
 * 🔐 AUTHENTIFICATION CÔTÉ ÉLÈVE (HERMÉTIQUE)
 */

router.post('/login', async (req, res) => {
    const { studentId } = req.body;
    const student = await Student.findById(studentId);
    if (student) {
        if (applyCrossDecay(student.behaviorRecords || [])) {
            student.markModified('behaviorRecords');
        }
        if (await syncPunishmentState(student)) {
            student.markModified('behaviorRecords');
        }
        await student.save();
        const plain = student.toObject();
        res.json({ ok: true, user: { ...plain, id: plain._id, role: 'student' } });
    } else {
        res.status(401).json({ ok: false, message: "Élève introuvable" });
    }
});

router.get('/student-fresh/:id', async (req, res) => {
    const student = await Student.findById(req.params.id);
    if (!student) return res.json(null);
    if (applyCrossDecay(student.behaviorRecords || [])) {
        student.markModified('behaviorRecords');
    }
    if (await syncPunishmentState(student)) {
        student.markModified('behaviorRecords');
    }
    await student.save();
    res.json(student.toObject());
});

module.exports = router;
