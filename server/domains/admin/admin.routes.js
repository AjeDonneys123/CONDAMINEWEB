const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AdminExpert = require('./experts/admin.expert');
const StructureDrive = require('../structure/experts/structure.drive');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * 🛡️ ROUTES ADMIN V59 - RÉPARATION ET RETOUR ÉLÈVE TEST
 */

router.get('/classrooms', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('Classroom').find({}).sort({ name: 1 }).lean());
}));

router.post('/classrooms', asyncHandler(async (req, res) => {
    const Classroom = mongoose.model('Classroom');
    const Student = mongoose.model('Student');
    const Enrollment = mongoose.model('Enrollment');
    const AcademicYear = mongoose.model('AcademicYear');

    const name = req.body.name.toUpperCase().trim();
    let year = await AcademicYear.findOne({ isCurrent: true }) || await AcademicYear.create({ label: "2025-2026", isCurrent: true });

    // 1. Création / Mise à jour classe
    const cls = await Classroom.findOneAndUpdate(
        { name }, { ...req.body, name, yearId: year._id }, { upsert: true, new: true }
    );

    // 2. Gestion élève test
    const testEmail = `test.${cls.name.toLowerCase().replace(/\s/g, '')}@condamine.local`;
    let testStudent = await Student.findOne({ email: testEmail });

    if (!testStudent) {
        testStudent = await Student.create({
            firstName: "Eleve",
            lastName: "Test",
            fullName: `Eleve Test (${cls.name})`,
            email: testEmail,
            classId: cls._id,
            currentClass: cls.name,
            isTestAccount: true
        });
    } else {
        // Sécurité : On s'assure que le flag est présent même sur les anciens
        testStudent.isTestAccount = true;
        testStudent.classId = cls._id;
        await testStudent.save();
    }

    await Enrollment.findOneAndUpdate(
        { studentId: testStudent._id, classId: cls._id },
        { studentId: testStudent._id, classId: cls._id, yearId: year._id },
        { upsert: true }
    );

    // Sync Drive en arrière plan
    StructureDrive.syncBaseStructure(); 

    // V59 : On renvoie l'élève test avec la classe pour le front
    res.json({ classroom: cls, testStudent });
}));

// Restauration des autres routes essentielles pour éviter les 404
router.get('/students', asyncHandler(async (req, res) => res.json(await mongoose.model('Student').find({}).sort({ lastName: 1 }).lean())));
router.get('/teachers', asyncHandler(async (req, res) => res.json(await mongoose.model('Teacher').find({}).sort({ lastName: 1 }).lean())));
router.get('/teachers/:id', asyncHandler(async (req, res) => {
    const t = await mongoose.model('Teacher').findById(req.params.id).lean() || await mongoose.model('Admin').findById(req.params.id).lean();
    res.json(t);
}));
router.post('/teachers', asyncHandler(async (req, res) => {
    const r = req.body._id ? await mongoose.model('Teacher').findByIdAndUpdate(req.body._id, req.body, { new: true }) : await mongoose.model('Teacher').create(req.body);
    await StructureDrive.syncBaseStructure();
    res.json(r);
}));
router.get('/admins', asyncHandler(async (req, res) => res.json(await mongoose.model('Admin').find({}).sort({ lastName: 1 }).lean())));
router.post('/admins', asyncHandler(async (req, res) => {
    const r = req.body._id ? await mongoose.model('Admin').findByIdAndUpdate(req.body._id, req.body, { new: true }) : await mongoose.model('Admin').create(req.body);
    await StructureDrive.syncBaseStructure();
    res.json(r);
}));
router.get('/database-dump', asyncHandler(async (req, res) => res.json(await AdminExpert.getFullDump())));
router.get('/drive-check', asyncHandler(async (req, res) => res.json(await AdminExpert.checkDriveStatus())));
router.delete('/:collection/:id', asyncHandler(async (req, res) => {
    const map = { 'classrooms': 'Classroom', 'teachers': 'Teacher', 'admins': 'Admin', 'students': 'Student' };
    if (map[req.params.collection]) await mongoose.model(map[req.params.collection]).findByIdAndDelete(req.params.id);
    res.json({ ok: true });
}));

module.exports = router;