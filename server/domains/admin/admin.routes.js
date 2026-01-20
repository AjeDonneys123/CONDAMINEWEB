const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AdminExpert = require('./experts/admin.expert');
const StructureDrive = require('../structure/experts/structure.drive');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * 🛡️ ROUTES ADMIN V97 - RESTAURATION COMPLÈTE
 */

// --- 1. MAINTENANCE & DIAG ---
router.get('/drive-check', asyncHandler(async (req, res) => res.json(await AdminExpert.checkDriveStatus())));
router.get('/database-dump', asyncHandler(async (req, res) => res.json(await AdminExpert.getFullDump())));

// --- 2. CLASSES & GROUPES ---
router.get('/classrooms', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('Classroom').find({}).sort({ name: 1 }).lean());
}));

router.post('/classrooms', asyncHandler(async (req, res) => {
    const Classroom = mongoose.model('Classroom');
    const name = req.body.name.toUpperCase().trim();
    const cls = await Classroom.findOneAndUpdate({ name }, { ...req.body, name }, { upsert: true, new: true });
    // Provisioning auto élève test
    await StructureDrive.syncBaseStructure();
    res.json(cls);
}));

// --- 3. MATIÈRES (RÉPARÉ V97) ---
router.get('/subjects', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('Subject').find({}).sort({ name: 1 }).lean());
}));

router.post('/subjects', asyncHandler(async (req, res) => {
    const name = req.body.name.toUpperCase().trim();
    const subj = await mongoose.model('Subject').findOneAndUpdate(
        { name }, 
        { name, color: req.body.color || '#6366f1' }, 
        { upsert: true, new: true }
    );
    res.json(subj);
}));

// --- 4. ENSEIGNANTS ---
router.get('/teachers', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('Teacher').find({}).sort({ lastName: 1 }).lean());
}));

router.get('/teachers/:id', asyncHandler(async (req, res) => {
    const user = await mongoose.model('Teacher').findById(req.params.id).lean() || await mongoose.model('Admin').findById(req.params.id).lean();
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });
    res.json(user);
}));

router.post('/teachers', asyncHandler(async (req, res) => {
    const result = req.body._id ? 
        await mongoose.model('Teacher').findByIdAndUpdate(req.body._id, req.body, { new: true }) : 
        await mongoose.model('Teacher').create(req.body);
    res.json(result);
}));

// --- 5. ÉLÈVES ---
router.get('/students', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('Student').find({}).sort({ lastName: 1 }).lean());
}));

router.post('/students', asyncHandler(async (req, res) => {
    const data = { ...req.body, fullName: `${req.body.firstName} ${req.body.lastName}` };
    const s = data._id ? await mongoose.model('Student').findByIdAndUpdate(data._id, data, { new: true }) : await mongoose.model('Student').create(data);
    res.json(s);
}));

// --- 6. DIRECTION ---
router.get('/admins', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('Admin').find({}).sort({ lastName: 1 }).lean());
}));

router.post('/admins', asyncHandler(async (req, res) => {
    const result = req.body._id ? await mongoose.model('Admin').findByIdAndUpdate(req.body._id, req.body, { new: true }) : await mongoose.model('Admin').create(req.body);
    res.json(result);
}));

// --- 7. SUPPRESSIONS ---
router.delete('/:collection/:id', asyncHandler(async (req, res) => {
    const map = { 'classrooms': 'Classroom', 'teachers': 'Teacher', 'admins': 'Admin', 'subjects': 'Subject', 'students': 'Student' };
    if (map[req.params.collection]) await mongoose.model(map[req.params.collection]).findByIdAndDelete(req.params.id);
    res.json({ ok: true });
}));

module.exports = router;