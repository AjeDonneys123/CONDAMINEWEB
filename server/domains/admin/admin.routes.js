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
    
    const existing = await Classroom.findOne({ name: req.body.name.toUpperCase().trim() });
    if (existing) return res.status(409).json({ error: `La classe ${existing.name} existe déjà.` });

    let year = await AcademicYear.findOne({ isCurrent: true });
    if (!year) year = await AcademicYear.create({ label: "2024-2025", isCurrent: true });

    const newClass = await Classroom.create({
        name: req.body.name.toUpperCase().trim(),
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
    const Subject = mongoose.model('Subject');
    const existing = await Subject.findOne({ name: req.body.name.toUpperCase().trim() });
    if (existing) return res.status(409).json({ error: `La matière ${existing.name} existe déjà.` });

    const newSubject = await Subject.create({
        name: req.body.name.toUpperCase().trim(),
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
    const Teacher = mongoose.model('Teacher');
    const fName = req.body.firstName.trim();
    const lName = req.body.lastName.trim();

    const existing = await Teacher.findOne({ 
        firstName: new RegExp(`^${fName}$`, 'i'), 
        lastName: new RegExp(`^${lName}$`, 'i') 
    });
    if (existing) return res.status(409).json({ error: `Le professeur ${fName} ${lName} existe déjà.` });

    const newTeacher = await Teacher.create(req.body);
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
    const Admin = mongoose.model('Admin');
    const fName = req.body.firstName.trim();
    const lName = req.body.lastName.trim();

    const existing = await Admin.findOne({ 
        firstName: new RegExp(`^${fName}$`, 'i'), 
        lastName: new RegExp(`^${lName}$`, 'i') 
    });
    if (existing) return res.status(409).json({ error: `L'admin ${fName} ${lName} existe déjà.` });

    const newAdmin = await Admin.create(req.body);
    res.json(newAdmin);
}));

router.delete('/admins/:id', asyncHandler(async (req, res) => {
    await mongoose.model('Admin').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
}));

// --- 5. GESTION DES ÉLÈVES ---
router.get('/students', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('Student').find({}).sort({ lastName: 1, firstName: 1 }));
}));

router.post('/students', asyncHandler(async (req, res) => {
    const Student = mongoose.model('Student');
    const Classroom = mongoose.model('Classroom');
    const Enrollment = mongoose.model('Enrollment');
    const AcademicYear = mongoose.model('AcademicYear');

    const fName = req.body.firstName.trim();
    const lName = req.body.lastName.trim();
    const classId = req.body.classId;

    if (!classId) return res.status(400).json({ error: "La sélection d'une classe est obligatoire." });

    const existing = await Student.findOne({ 
        firstName: new RegExp(`^${fName}$`, 'i'), 
        lastName: new RegExp(`^${lName}$`, 'i') 
    });
    if (existing) return res.status(409).json({ error: `L'élève ${fName} ${lName} existe déjà.` });

    const cls = await Classroom.findById(classId);
    if (!cls) return res.status(404).json({ error: "Classe introuvable." });

    // CRÉATION AVEC LIENS CLASSE ROBUSTES
    const newStudent = await Student.create({
        firstName: fName,
        lastName: lName.toUpperCase(),
        email: req.body.email || "",
        currentClass: cls.name, // Sauvegarde du Nom
        classId: cls._id        // Sauvegarde de l'ID
    });

    const year = await AcademicYear.findOne({ isCurrent: true });
    if (year) {
        await Enrollment.create({
            studentId: newStudent._id,
            classId: classId,
            yearId: year._id
        });
    }

    res.json(newStudent);
}));

router.delete('/students/:id', asyncHandler(async (req, res) => {
    const Enrollment = mongoose.model('Enrollment');
    const Student = mongoose.model('Student');
    
    await Student.findByIdAndDelete(req.params.id);
    await Enrollment.deleteMany({ studentId: req.params.id });
    await mongoose.model('Submission').deleteMany({ studentId: req.params.id });
    
    res.json({ ok: true });
}));

// --- 6. RAPPORTS DE BUGS ---
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
        // MIGRATION AVEC VALEURS PAR DÉFAUT
        if (!student) student = await mongoose.model('Student').create({ 
            firstName: p.firstName, 
            lastName: p.lastName, 
            currentClass: p.classroom || "UNKNOWN" 
        });
        
        if (p.classroom) {
            let cls = await mongoose.model('Classroom').findOne({ name: p.classroom.toUpperCase() });
            if (!cls) cls = await mongoose.model('Classroom').create({ name: p.classroom.toUpperCase(), yearId: year?._id });
            const ex = await mongoose.model('Enrollment').findOne({ studentId: student._id, classId: cls._id });
            if (!ex) await mongoose.model('Enrollment').create({ studentId: student._id, classId: cls._id, yearId: year?._id });
            
            // Mise à jour rétroactive du lien classId
            if (!student.classId) {
                student.classId = cls._id;
                await student.save();
            }
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