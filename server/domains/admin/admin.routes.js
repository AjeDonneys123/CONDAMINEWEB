const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AdminExpert = require('./experts/admin.expert');

// Wrapper pour gérer les erreurs async automatiquement
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// --- 1. IMPORTATION IA ---
router.post('/import/analyze', asyncHandler(async (req, res) => res.json(await AdminExpert.analyzeImportData(req.body))));
router.post('/import/execute', asyncHandler(async (req, res) => res.json(await AdminExpert.executeImport(req.body.classId, req.body.data, req.body.type))));

// --- 2. SYSTÈME & OUTILS (C'est ici que manquait votre route) ---
router.get('/drive-check', asyncHandler(async (req, res) => res.json(await AdminExpert.checkDriveStatus())));
router.get('/database-dump', asyncHandler(async (req, res) => res.json(await AdminExpert.getFullDump()))); // <--- LA ROUTE MANQUANTE
router.get('/project-tree', asyncHandler(async (req, res) => res.json(await AdminExpert.getProjectTree())));
router.post('/init-tree', asyncHandler(async (req, res) => res.json({ ok: true }))); 

// --- 3. MAINTENANCE ---
router.post('/maintenance/migrate-legacy', asyncHandler(async (req, res) => res.json(await AdminExpert.migrateLegacy())));
router.post('/maintenance/resync-enrollments', asyncHandler(async (req, res) => res.json(await AdminExpert.resyncEnrollments())));
router.post('/maintenance/purge-orphans', asyncHandler(async (req, res) => res.json(await AdminExpert.purgeOrphans())));

// --- 4. CRUD GÉNÉRIQUES ---

// CLASSROOMS
router.get('/classrooms', asyncHandler(async (req, res) => res.json(await mongoose.model('Classroom').find({}).sort({ name: 1 }))));
router.post('/classrooms', asyncHandler(async (req, res) => {
    const existing = await mongoose.model('Classroom').findOne({ name: req.body.name.toUpperCase().trim() });
    if(existing) return res.status(409).json({error: "Existe déjà"});
    let year = await mongoose.model('AcademicYear').findOne({ isCurrent: true });
    if(!year) year = await mongoose.model('AcademicYear').create({ label: "2024-2025", isCurrent: true });
    res.json(await mongoose.model('Classroom').create({ name: req.body.name.toUpperCase(), type: req.body.type, yearId: year._id }));
}));
router.delete('/classrooms/:id', asyncHandler(async (req, res) => { await mongoose.model('Classroom').findByIdAndDelete(req.params.id); res.json({ok:true}); }));

// SUBJECTS
router.get('/subjects', asyncHandler(async (req, res) => res.json(await mongoose.model('Subject').find({}).sort({ name: 1 }))));
router.post('/subjects', asyncHandler(async (req, res) => res.json(await mongoose.model('Subject').create(req.body))));
router.delete('/subjects/:id', asyncHandler(async (req, res) => { await mongoose.model('Subject').findByIdAndDelete(req.params.id); res.json({ok:true}); }));

// STUDENTS
router.get('/students', asyncHandler(async (req, res) => res.json(await mongoose.model('Student').find({}).sort({ lastName: 1 }))));
router.post('/students', asyncHandler(async (req, res) => {
    let year = await mongoose.model('AcademicYear').findOne({ isCurrent: true });
    if(!year) year = await mongoose.model('AcademicYear').create({ label: "2024-2025", isCurrent: true });
    
    const studentData = { ...req.body, fullName: `${req.body.firstName} ${req.body.lastName}` };
    
    if(req.body._id) {
        // Mode UPDATE
        const s = await mongoose.model('Student').findByIdAndUpdate(req.body._id, studentData, {new:true});
        if(req.body.classId) {
             const cls = await mongoose.model('Classroom').findById(req.body.classId);
             if(cls) await mongoose.model('Student').findByIdAndUpdate(s._id, { currentClass: cls.name });
             await mongoose.model('Enrollment').findOneAndUpdate(
                 { studentId: s._id }, 
                 { studentId: s._id, classId: req.body.classId, yearId: year._id }, 
                 { upsert: true }
             );
        }
        res.json(s);
    } else {
        // Mode CREATE
        const s = await mongoose.model('Student').create(studentData);
        if(req.body.classId) {
            const cls = await mongoose.model('Classroom').findById(req.body.classId);
            if(cls) await mongoose.model('Student').findByIdAndUpdate(s._id, { currentClass: cls.name });
            await mongoose.model('Enrollment').create({ studentId: s._id, classId: req.body.classId, yearId: year._id });
        }
        res.json(s);
    }
}));
router.delete('/students/:id', asyncHandler(async (req, res) => {
    await mongoose.model('Student').findByIdAndDelete(req.params.id);
    await mongoose.model('Enrollment').deleteMany({ studentId: req.params.id });
    res.json({ok:true});
}));

// TEACHERS
router.get('/teachers', asyncHandler(async (req, res) => res.json(await mongoose.model('Teacher').find({}))));
router.post('/teachers', asyncHandler(async (req, res) => {
    if(req.body._id) res.json(await mongoose.model('Teacher').findByIdAndUpdate(req.body._id, req.body, {new:true}));
    else res.json(await mongoose.model('Teacher').create(req.body));
}));
router.delete('/teachers/:id', asyncHandler(async (req, res) => { await mongoose.model('Teacher').findByIdAndDelete(req.params.id); res.json({ok:true}); }));

// ADMINS
router.get('/admins', asyncHandler(async (req, res) => res.json(await mongoose.model('Admin').find({}))));
router.post('/admins', asyncHandler(async (req, res) => {
    if(req.body._id) res.json(await mongoose.model('Admin').findByIdAndUpdate(req.body._id, req.body, {new:true}));
    else res.json(await mongoose.model('Admin').create(req.body));
}));
router.delete('/admins/:id', asyncHandler(async (req, res) => { await mongoose.model('Admin').findByIdAndDelete(req.params.id); res.json({ok:true}); }));

// BUGS
router.get('/bugs', asyncHandler(async (req, res) => res.json(await mongoose.model('BugReport').find({}).sort({createdAt: -1}))));
router.patch('/bugs/:id', asyncHandler(async (req, res) => {
    const bug = await mongoose.model('BugReport').findById(req.params.id);
    if(bug) { bug.status = 'fixed'; await bug.save(); }
    res.json(bug);
}));

module.exports = router;