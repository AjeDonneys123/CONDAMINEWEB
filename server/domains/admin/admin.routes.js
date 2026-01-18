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

router.patch('/classrooms/:id', asyncHandler(async (req, res) => {
    const Classroom = mongoose.model('Classroom');
    const { name, type } = req.body;
    
    const existing = await Classroom.findOne({ name: name.toUpperCase().trim(), _id: { $ne: req.params.id } });
    if (existing) return res.status(409).json({ error: "Ce nom de classe est déjà pris." });

    const updated = await Classroom.findByIdAndUpdate(req.params.id, { 
        name: name.toUpperCase().trim(), 
        type 
    }, { new: true });
    
    if (updated) {
        await mongoose.model('Student').updateMany({ classId: updated._id }, { currentClass: updated.name });
    }

    res.json(updated);
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

router.patch('/subjects/:id', asyncHandler(async (req, res) => {
    const Subject = mongoose.model('Subject');
    const { name, color } = req.body;
    
    const existing = await Subject.findOne({ name: name.toUpperCase().trim(), _id: { $ne: req.params.id } });
    if (existing) return res.status(409).json({ error: "Cette matière existe déjà." });

    const updated = await Subject.findByIdAndUpdate(req.params.id, { 
        name: name.toUpperCase().trim(), 
        color 
    }, { new: true });
    res.json(updated);
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

router.patch('/teachers/:id', asyncHandler(async (req, res) => {
    const Teacher = mongoose.model('Teacher');
    const updated = await Teacher.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
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

router.patch('/admins/:id', asyncHandler(async (req, res) => {
    const Admin = mongoose.model('Admin');
    const updated = await Admin.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
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
    
    // GESTION DU NOM COMPLET
    const fullNameToSave = req.body.fullName ? req.body.fullName.trim() : `${fName} ${lName.toUpperCase()}`;

    const newStudent = await Student.create({
        firstName: fName,
        lastName: lName.toUpperCase(),
        fullName: fullNameToSave,
        email: req.body.email || "",
        birthDate: req.body.birthDate || null,
        gender: req.body.gender || "",
        currentClass: cls.name,
        classId: cls._id
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

router.patch('/students/:id', asyncHandler(async (req, res) => {
    const Student = mongoose.model('Student');
    const Enrollment = mongoose.model('Enrollment');
    const Classroom = mongoose.model('Classroom');
    const AcademicYear = mongoose.model('AcademicYear');

    const { firstName, lastName, fullName, email, classId, birthDate, gender } = req.body;
    const studentId = req.params.id;

    const updateData = {
        firstName: firstName.trim(),
        lastName: lastName.toUpperCase().trim(),
        fullName: fullName ? fullName.trim() : undefined,
        email: email,
        birthDate: birthDate || null,
        gender: gender || ""
    };

    if (classId) {
        const cls = await Classroom.findById(classId);
        if (cls) {
            updateData.classId = cls._id;
            updateData.currentClass = cls.name;

            const year = await AcademicYear.findOne({ isCurrent: true });
            if (year) {
                await Enrollment.deleteMany({ studentId: studentId, yearId: year._id });
                await Enrollment.create({
                    studentId: studentId,
                    classId: cls._id,
                    yearId: year._id
                });
            }
        }
    }

    const updated = await Student.findByIdAndUpdate(studentId, updateData, { new: true });
    res.json(updated);
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