// @signatures: ProfAdminRouter, listAll, driveCheck
const express = require('express');
const router = express.Router();
const { Classroom, Student, Teacher, Admin, Subject } = require('../models/prof.models');

/**
 * 🛡️ BLOC ADMIN PROF (/api/admin)
 * Gère l'infrastructure et les vérifications système.
 */

// ✅ RÉPARATION : Route de vérification du Drive (appelée par ProfHeader.jsx)
router.get('/drive-check', async (req, res) => {
    try {
        const hasToken = !!process.env.GOOGLE_REFRESH_TOKEN;
        const hasClientId = !!process.env.GOOGLE_CLIENT_ID;
        
        res.json({ 
            ok: hasToken && hasClientId, 
            email: hasToken ? "Connecté (Drive Pro)" : "Non configuré" 
        });
    } catch (e) {
        res.status(500).json({ ok: false, email: '' });
    }
});

router.get('/classrooms', async (req, res) => {
    try {
        const list = await Classroom.find({}).lean();
        res.json(list.sort((a,b) => (a.name || "").localeCompare(b.name || "")));
    } catch (e) { res.status(500).json({ error: "DB FAIL" }); }
});

router.get('/students', async (req, res) => {
    try {
        const list = await Student.find({}).sort({ lastName: 1 }).lean();
        res.json(list);
    } catch (e) { res.status(500).json({ error: "DB FAIL" }); }
});

router.get('/teachers/:id', async (req, res) => {
    try {
        const user = await Teacher.findById(req.params.id).lean() || await Admin.findById(req.params.id).lean();
        res.json(user || {});
    } catch (e) { res.status(500).json({ error: "DB FAIL" }); }
});

router.get('/subjects', async (req, res) => {
    try {
        const list = await Subject.find({}).sort({ name: 1 }).lean();
        res.json(list);
    } catch (e) { res.json([]); }
});

module.exports = router;
