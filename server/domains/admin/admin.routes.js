const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AdminExpert = require('./experts/admin.expert');
const StructureDrive = require('../structure/experts/structure.drive');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// --- 1. ROUTES DE MAINTENANCE & DIAGNOSTIC (RÉPARÉES) ---
router.get('/drive-check', asyncHandler(async (req, res) => {
    const status = await AdminExpert.checkDriveStatus();
    res.json(status);
}));

router.get('/database-dump', asyncHandler(async (req, res) => {
    res.json(await AdminExpert.getFullDump());
}));

// --- 2. CLASSES & GROUPES ---
router.get('/classrooms', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('Classroom').find({}).sort({ name: 1 }).lean());
}));

router.post('/classrooms', asyncHandler(async (req, res) => {
    const name = req.body.name.toUpperCase().trim();
    const cls = await mongoose.model('Classroom').findOneAndUpdate(
        { name }, { ...req.body, name }, { upsert: true, new: true }
    );
    await StructureDrive.syncBaseStructure(); 
    res.json(cls);
}));

router.delete('/classrooms/:id', asyncHandler(async (req, res) => {
    await mongoose.model('Classroom').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
}));

// --- 3. ENSEIGNANTS ---
router.get('/teachers', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('Teacher').find({}).sort({ lastName: 1 }).lean());
}));

router.post('/teachers', asyncHandler(async (req, res) => {
    const result = req.body._id ? 
        await mongoose.model('Teacher').findByIdAndUpdate(req.body._id, req.body, { new: true }) : 
        await mongoose.model('Teacher').create(req.body);
    await StructureDrive.syncBaseStructure();
    res.json(result);
}));

// --- 4. ÉLÈVES ---
router.get('/students', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('Student').find({}).sort({ lastName: 1 }).lean());
}));

router.post('/students', asyncHandler(async (req, res) => {
    const data = { ...req.body, fullName: `${req.body.firstName} ${req.body.lastName}` };
    const s = data._id ? await mongoose.model('Student').findByIdAndUpdate(data._id, data, { new: true }) : await mongoose.model('Student').create(data);
    if (req.body.classId) {
        const cls = await mongoose.model('Classroom').findById(req.body.classId);
        if (cls) {
            await mongoose.model('Student').findByIdAndUpdate(s._id, { currentClass: cls.name });
            await mongoose.model('Enrollment').findOneAndUpdate({ studentId: s._id }, { studentId: s._id, classId: req.body.classId, yearId: "696d5129dc6d769124068fc0" }, { upsert: true });
        }
    }
    await StructureDrive.syncBaseStructure();
    res.json(s);
}));

// --- 5. STAFF (DIRECTION) ---
router.get('/admins', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('Admin').find({}).sort({ lastName: 1 }).lean());
}));

router.post('/admins', asyncHandler(async (req, res) => {
    const result = req.body._id ? await mongoose.model('Admin').findByIdAndUpdate(req.body._id, req.body, { new: true }) : await mongoose.model('Admin').create(req.body);
    await StructureDrive.syncBaseStructure();
    res.json(result);
}));

// --- 6. MATIÈRES ---
router.get('/subjects', asyncHandler(async (req, res) => res.json(await mongoose.model('Subject').find({}).sort({ name: 1 }).lean())));
router.post('/subjects', asyncHandler(async (req, res) => res.json(await mongoose.model('Subject').create(req.body))));

// --- 7. SUPPRESSIONS ---
router.delete('/:collection/:id', asyncHandler(async (req, res) => {
    const map = { 'classrooms': 'Classroom', 'teachers': 'Teacher', 'admins': 'Admin', 'subjects': 'Subject', 'students': 'Student' };
    if (map[req.params.collection]) await mongoose.model(map[req.params.collection]).findByIdAndDelete(req.params.id);
    res.json({ ok: true });
}));

module.exports = router;