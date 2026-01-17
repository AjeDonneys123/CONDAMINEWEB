const express = require('express');
const router = express.Router();
const AdminExpert = require('./experts/admin.expert');
const AdminDB = require('./db/admin.db');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Wrapper de sécurité
const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
        console.error(`[ROUTE ERROR] ${req.method} ${req.originalUrl}:`, err);
        if (err.code === 11000) {
            const field = Object.keys(err.keyValue || {})[0] || "Inconnu";
            return res.status(400).json({ error: `DOUBLON (Index BDD) sur : '${field}'` });
        }
        res.status(500).json({ error: err.message });
    });
};

// --- 1. SANTÉ ---
router.get('/db-check', asyncHandler(async (req, res) => res.json({ ok: AdminDB.checkConnection() })));
router.get('/drive-check', asyncHandler(async (req, res) => {
    const DriveEngine = require('../../core/drive.engine');
    res.json(await DriveEngine.testAuth() || { ok: false });
}));

// --- 2. IMPORT ---
router.post('/import/analyze', asyncHandler(async (req, res) => {
    if (!req.body.text && !req.body.image) return res.status(400).json({ error: "Aucune donnée" });
    const students = await AdminExpert.analyzeImportData(req.body);
    res.json(students);
}));
router.post('/import/execute', asyncHandler(async (req, res) => {
    const result = await AdminExpert.executeImport(req.body.classId, req.body.students);
    res.json(result);
}));

// --- 3. MAINTENANCE ---
router.post('/maintenance/resync-classes', asyncHandler(async (req, res) => {
    const report = await AdminExpert.resyncEnrollments();
    res.json({ ok: true, message: `Terminé ! ${report.fixed} liens réparés.` });
}));
router.post('/maintenance/purge-orphans', asyncHandler(async (req, res) => {
    const report = await AdminExpert.purgeOrphans();
    res.json({ ok: true, message: `Purge terminée : ${report.deleted} supprimés.` });
}));
router.post('/maintenance/total-sync', asyncHandler(async (req, res) => {
    const report = await AdminExpert.totalSyncAndKill();
    res.json({ ok: true, message: `SYNC & KILL : ${report.deleted} supprimés.` });
}));
router.post('/maintenance/fix-admins', asyncHandler(async (req, res) => { await AdminDB.dropAdminIndexes(); res.json({ ok: true }); }));

// --- 4. CRUD ---
router.get('/database-dump', asyncHandler(async (req, res) => {
    const models = ['AcademicYear', 'Admin', 'Classroom', 'Subject', 'Teacher', 'Student', 'Enrollment', 'Chapter', 'Homework', 'Game', 'GameLevel', 'Submission', 'BugReport'];
    const dump = {};
    for (const m of models) { try { dump[m] = await mongoose.model(m).find({}).limit(100).lean(); } catch (e) { dump[m] = []; } }
    res.json(dump);
}));
router.delete('/raw-delete/:model/:id', asyncHandler(async (req, res) => {
    if (!mongoose.models[req.params.model]) throw new Error("Modèle inconnu");
    await mongoose.model(req.params.model).findByIdAndDelete(req.params.id);
    res.json({ ok: true });
}));

// Admins
router.get('/admins', asyncHandler(async (req, res) => res.json(await AdminDB.findAllAdmins())));
router.post('/admins', asyncHandler(async (req, res) => {
    if (!req.body.firstName || !req.body.lastName || !req.body.password) throw new Error("Champs requis");
    const newItem = await AdminExpert.createAdminSafe({ ...req.body, role: req.body.role || 'admin' });
    res.json(newItem);
}));
router.delete('/admins/:id', asyncHandler(async (req, res) => { await AdminDB.deleteItem('Admin', req.params.id); res.json({ok:true}); }));

// Teachers
router.get('/teachers', asyncHandler(async (req, res) => res.json(await AdminDB.findAllTeachers())));
router.post('/teachers', asyncHandler(async (req, res) => res.json(await AdminDB.createItem('Teacher', req.body))));
router.delete('/teachers/:id', asyncHandler(async (req, res) => { await AdminDB.deleteItem('Teacher', req.params.id); res.json({ok:true}); }));

// Classrooms & Groups (UPDATE v.31)
router.get('/classrooms', asyncHandler(async (req, res) => res.json(await AdminDB.findAllClassrooms())));
router.post('/classrooms', asyncHandler(async (req, res) => {
    const name = req.body.name.toUpperCase().trim();
    const type = req.body.type || 'CLASS'; // 'CLASS' ou 'GROUP'
    const existing = await mongoose.model('Classroom').findOne({ name });
    if (existing) throw new Error(`Ce nom (${name}) est déjà pris !`);
    
    res.json(await AdminDB.createItem('Classroom', { ...req.body, name, type }));
}));
router.delete('/classrooms/:id', asyncHandler(async (req, res) => {
    const classId = req.params.id;
    const enrollments = await mongoose.model('Enrollment').find({ classId });
    const studentIds = enrollments.map(e => e.studentId);
    // On supprime les liens, mais on ne supprime les élèves QUE si c'était leur seule classe (à voir plus tard, pour l'instant on garde le comportement cascade strict pour la propreté)
    if (studentIds.length > 0) await mongoose.model('Student').deleteMany({ _id: { $in: studentIds } });
    if (enrollments.length > 0) await mongoose.model('Enrollment').deleteMany({ classId });
    await AdminDB.deleteItem('Classroom', classId);
    res.json({ ok: true });
}));

// Subjects
router.get('/subjects', asyncHandler(async (req, res) => res.json(await AdminDB.findAllSubjects())));
router.post('/subjects', asyncHandler(async (req, res) => res.json(await AdminDB.createItem('Subject', req.body))));
router.delete('/subjects/:id', asyncHandler(async (req, res) => { await AdminDB.deleteItem('Subject', req.params.id); res.json({ok:true}); }));

// Students
router.get('/enrollments', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('Enrollment').find({ classId: req.query.classId }).populate('studentId').lean() || []);
}));
router.post('/students', asyncHandler(async (req, res) => {
    const student = await AdminDB.createItem('Student', req.body);
    const year = await mongoose.model('AcademicYear').findOne({ isCurrent: true });
    if (req.body.classId && year) await AdminDB.createItem('Enrollment', { studentId: student._id, classId: req.body.classId, yearId: year._id });
    res.json(student);
}));

router.get('/bugs', asyncHandler(async (req, res) => res.json(await AdminDB.findAllBugs())));
router.post('/report-bug', asyncHandler(async (req, res) => { await AdminDB.createItem('BugReport', req.body); res.json({ok:true}); }));
router.patch('/bugs/:id', asyncHandler(async (req, res) => { await mongoose.model('BugReport').findByIdAndUpdate(req.params.id, {status:'fixed'}); res.json({ok:true}); }));

router.get('/project-tree', asyncHandler(async (req, res) => res.json(await AdminExpert.getProjectTree())));
router.post('/init-tree', asyncHandler(async (req, res) => res.json(await AdminExpert.initTreeFromStaticFile())));
router.post('/report-snapshot', asyncHandler(async (req, res) => res.json({ ok: !!AdminExpert.getCurrentCode() })));
router.post('/report-fix', asyncHandler(async (req, res) => res.json(await AdminExpert.generateFix(req.body.logs))));
router.post('/report-execute', asyncHandler(async (req, res) => { fs.writeFileSync(path.join(process.cwd(), 'update.txt'), req.body.patch); res.json({ ok: true }); }));
router.post('/system-reset', asyncHandler(async (req, res) => { await AdminExpert.systemReset(); res.json({ ok: true }); }));

module.exports = router;