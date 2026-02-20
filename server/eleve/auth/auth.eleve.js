// @signatures: EleveAuth, login, freshData
const express = require('express');
const router = express.Router();
const { Student } = require('../models/eleve.models');
const CROSS_DECAY_MS = 14 * 24 * 60 * 60 * 1000;

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
            await student.save();
        }
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
        await student.save();
    }
    res.json(student.toObject());
});

module.exports = router;
