// @signatures: EleveAuth, login, freshData
const express = require('express');
const router = express.Router();
const { Student } = require('../models/eleve.models');

/**
 * 🔐 AUTHENTIFICATION CÔTÉ ÉLÈVE (HERMÉTIQUE)
 */

router.post('/login', async (req, res) => {
    const { studentId } = req.body;
    const student = await Student.findById(studentId).lean();
    if (student) {
        res.json({ ok: true, user: { ...student, id: student._id, role: 'student' } });
    } else {
        res.status(401).json({ ok: false, message: "Élève introuvable" });
    }
});

router.get('/student-fresh/:id', async (req, res) => {
    const student = await Student.findById(req.params.id).lean();
    res.json(student);
});

module.exports = router;
