// @signatures: AdminRoutes, driveCheck, students, classrooms
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AdminExpert = require('./experts/admin.expert');
const StructureDrive = require('../structure/experts/structure.drive');
const { sendLatePunishmentMail, resetLateMailState } = require('../../services/punishmentMailer');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// --- ROUTES CRITIQUES POUR LE PROF ---

// 1. Check Drive (Indispensable pour le voyant vert)
router.get('/drive-check', asyncHandler(async (req, res) => res.json(await AdminExpert.checkDriveStatus())));

// 2. Classes (Indispensable pour le menu du haut)
router.get('/classrooms', asyncHandler(async (req, res) => { 
    const classes = await mongoose.model('Classroom').find({}).sort({ name: 1 }).lean(); 
    res.json(classes); 
}));

// 3. Élèves (Indispensable pour la distribution)
router.get('/students', asyncHandler(async (req, res) => { 
    res.json(await mongoose.model('Student').find({}).sort({ lastName: 1 }).lean()); 
}));

// 4. Matières
router.get('/subjects', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('Subject').find({}).sort({ name: 1 }).lean());
}));

// 5. Enseignants (Pour le profil)
router.get('/teachers/:id', asyncHandler(async (req, res) => { 
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: "ID Invalide" }); 
    let user = await mongoose.model('Teacher').findById(req.params.id).lean() || await mongoose.model('Admin').findById(req.params.id).lean(); 
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" }); 
    res.json(user); 
}));

// 6. Dump BDD (Pour le visualiseur BDD)
router.get('/database-dump', asyncHandler(async (req, res) => res.json(await AdminExpert.getFullDump())));

// 7. Test envoi mail punition (diagnostic)
router.post('/punishment-mail-test', asyncHandler(async (req, res) => {
    const Student = mongoose.model('Student');
    const { studentId, reset = false } = req.body || {};

    let student = null;
    if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
        student = await Student.findById(studentId);
    } else {
        student = await Student.findOne({
            firstName: /julian/i,
            lastName: /^p/i,
            currentClass: { $in: ['5B', '5 B', '5b', '5 b'] }
        });
    }

    if (!student) return res.status(404).json({ ok: false, error: 'Student not found for test' });

    if (reset) {
        resetLateMailState(student);
    }
    student.punishmentStatus = 'LATE';
    const result = await sendLatePunishmentMail(student, { force: true });
    await student.save();

    res.json({
        ok: true,
        result,
        student: {
            id: student._id,
            firstName: student.firstName,
            lastName: student.lastName,
            currentClass: student.currentClass,
            punishmentStatus: student.punishmentStatus,
            punishmentLateMailSentAt: student.punishmentLateMailSentAt,
            punishmentLateMailTo: student.punishmentLateMailTo,
            punishmentLateMailError: student.punishmentLateMailError
        },
        mailConfig: {
            hasEmailUser: Boolean(process.env.EMAIL_USER),
            hasEmailPass: Boolean(process.env.EMAIL_PASS)
        }
    });
}));

module.exports = router;
