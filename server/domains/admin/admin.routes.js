const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// --- 1. GESTION DES CLASSES ---
router.get('/classrooms', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('Classroom').find({}).sort({ name: 1 }));
}));

router.post('/classrooms', asyncHandler(async (req, res) => {
    const Classroom = mongoose.model('Classroom');
    const AcademicYear = mongoose.model('AcademicYear');
    
    let year = await AcademicYear.findOne({ isCurrent: true });
    if (!year) year = await AcademicYear.create({ label: "2024-2025", isCurrent: true });

    const newClass = await Classroom.create({
        name: req.body.name.toUpperCase(),
        type: req.body.type || 'CLASS',
        yearId: year._id
    });
    res.json(newClass);
}));

router.delete('/classrooms/:id', asyncHandler(async (req, res) => {
    await mongoose.model('Classroom').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
}));

// --- 2. GESTION DES MATIÈRES ---
router.get('/subjects', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('Subject').find({}).sort({ name: 1 }));
}));

router.post('/subjects', asyncHandler(async (req, res) => {
    const newSubject = await mongoose.model('Subject').create({
        name: req.body.name.toUpperCase(),
        color: req.body.color || '#6366f1'
    });
    res.json(newSubject);
}));

router.delete('/subjects/:id', asyncHandler(async (req, res) => {
    await mongoose.model('Subject').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
}));

// --- 3. GESTION DES ENSEIGNANTS ---
router.get('/teachers', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('Teacher').find({}).sort({ lastName: 1 }));
}));

router.post('/teachers', asyncHandler(async (req, res) => {
    const newTeacher = await mongoose.model('Teacher').create(req.body);
    res.json(newTeacher);
}));

router.delete('/teachers/:id', asyncHandler(async (req, res) => {
    await mongoose.model('Teacher').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
}));

// --- 4. GESTION DU STAFF (ADMINS) ---
router.get('/admins', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('Admin').find({}).sort({ lastName: 1 }));
}));

router.post('/admins', asyncHandler(async (req, res) => {
    const newAdmin = await mongoose.model('Admin').create(req.body);
    res.json(newAdmin);
}));

router.delete('/admins/:id', asyncHandler(async (req, res) => {
    await mongoose.model('Admin').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
}));

// --- 5. RAPPORTS DE BUGS ---
router.get('/bugs', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('BugReport').find({}).sort({ createdAt: -1 }));
}));

router.patch('/bugs/:id', asyncHandler(async (req, res) => {
    await mongoose.model('BugReport').findByIdAndUpdate(req.params.id, { status: 'fixed' });
    res.json({ ok: true });
}));

// --- DIAGNOSTIC & MAINTENANCE ---
router.get('/database-dump', asyncHandler(async (req, res) => {
    const collections = {
        academicyears: 'AcademicYear',
        enrollments: 'Enrollment',
        students: 'Student',
        classrooms: 'Classroom',
        subjects: 'Subject',
        teachers: 'Teacher',
        admins: 'Admin',
        chapters: 'Chapter',
        homeworks: 'Homework',
        submissions: 'Submission',
        bugreports: 'BugReport',
        players_legacy: 'Player'
    };
    const dump = {};
    for (const [key, modelName] of Object.entries(collections)) {
        try {
            if (mongoose.models[modelName]) {
                dump[key] = await mongoose.model(modelName).find({}).limit(500).lean();
            } else { dump[key] = []; }
        } catch (e) { dump[key] = []; }
    }
    res.json(dump);
}));

router.post('/maintenance/migrate-legacy', asyncHandler(async (req, res) => {
    const legacy = await mongoose.model('Player').find({});
    let count = 0;
    const year = await mongoose.model('AcademicYear').findOne({ isCurrent: true });
    for (const p of legacy) {
        let student = await mongoose.model('Student').findOne({ firstName: p.firstName, lastName: p.lastName });
        if (!student) student = await mongoose.model('Student').create({ firstName: p.firstName, lastName: p.lastName, currentClass: p.classroom });
        if (p.classroom) {
            let cls = await mongoose.model('Classroom').findOne({ name: p.classroom.toUpperCase() });
            if (!cls) cls = await mongoose.model('Classroom').create({ name: p.classroom.toUpperCase(), yearId: year?._id });
            const ex = await mongoose.model('Enrollment').findOne({ studentId: student._id, classId: cls._id });
            if (!ex) await mongoose.model('Enrollment').create({ studentId: student._id, classId: cls._id, yearId: year?._id });
        }
        count++;
    }
    res.json({ ok: true, message: `${count} migrés.` });
}));

router.get('/drive-check', async (req, res) => {
    const DriveEngine = require('../../core/drive.engine');
    res.json(await DriveEngine.testAuth() || { ok: false });
});

module.exports = router;