// @signatures: ProfAuth, login, config, finder
const express = require('express');
const router = express.Router();
const { Teacher, Admin, Student, Classroom } = require('../models/prof.models');
const bcrypt = require('bcryptjs');

/**
 * 🔐 AUTHENTIFICATION CÔTÉ PROF (HERMÉTIQUE)
 */

router.post('/login', async (req, res) => {
    const { firstName, lastName, password } = req.body;
    const fName = (firstName || '').trim();
    const lName = (lastName || '').trim();
    
    let user = await Teacher.findOne({ firstName: new RegExp(`^${fName}$`, 'i'), lastName: new RegExp(`^${lName}$`, 'i') }) 
            || await Admin.findOne({ firstName: new RegExp(`^${fName}$`, 'i'), lastName: new RegExp(`^${lName}$`, 'i') });

    if (user && (user.password.startsWith('$2a$') ? await bcrypt.compare(password, user.password) : user.password === password)) {
        const obj = user.toObject();
        delete obj.password;
        return res.json({ ok: true, user: { ...obj, id: obj._id, role: obj.role || 'prof' } });
    }
    res.status(401).json({ ok: false, message: "Identifiants prof incorrects" });
});

router.get('/config', async (req, res) => {
    res.json({ classrooms: await Classroom.find({}).sort({name:1}).lean() });
});

// Données pour le moteur de recherche d'élèves (Admin/Prof)
router.get('/finder-data', async (req, res) => {
    const list = await Student.find({}, 'firstName lastName currentClass').lean();
    res.json(list.map(s => ({ id: s._id, firstName: s.firstName, lastName: s.lastName, className: s.currentClass })));
});

module.exports = router;
