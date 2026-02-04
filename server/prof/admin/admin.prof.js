// @signatures: ProfAdminRouter, listAll, driveCheck, databaseDump
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AdminExpert = require('../../domains/admin/experts/admin.expert');

// 1. VÉRIFICATION DRIVE (Header)
router.get('/drive-check', async (req, res) => {
    const status = await AdminExpert.checkDriveStatus();
    res.json(status);
});

// 2. MOUCHARD BDD (Le bouton qui plantait)
router.get('/database-dump', async (req, res) => {
    try {
        const dump = await AdminExpert.getFullDump();
        res.json(dump);
    } catch (e) {
        console.error("Dump Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// 3. LISTES SIMPLES
router.get('/classrooms', async (req, res) => {
    res.json(await mongoose.model('Classroom').find({}).sort({ name: 1 }).lean());
});

router.get('/students', async (req, res) => {
    res.json(await mongoose.model('Student').find({}).sort({ lastName: 1 }).lean());
});

router.get('/teachers/:id', async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.json({});
    const user = await mongoose.model('Teacher').findById(id).lean() || await mongoose.model('Admin').findById(id).lean();
    res.json(user || {});
});

router.get('/subjects', async (req, res) => {
    res.json(await mongoose.model('Subject').find({}).sort({ name: 1 }).lean());
});

module.exports = router;
