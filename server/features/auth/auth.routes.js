const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.post('/login-step-1', async (req, res) => {
    try {
        const { firstName, lastName } = req.body;
        const Teacher = mongoose.model('Teacher');
        const Player = mongoose.model('Player');

        const teacher = await Teacher.findOne({ 
            firstName: new RegExp('^' + firstName + '$', 'i'), 
            lastName: new RegExp('^' + lastName + '$', 'i') 
        });
        if (teacher) return res.json({ isTeacher: true });

        const student = await Player.findOne({ 
            firstName: new RegExp('^' + firstName + '$', 'i'), 
            lastName: new RegExp('^' + lastName + '$', 'i') 
        });
        if (student) return res.json({ isStudent: true, user: { ...student._doc, id: student._id } });

        res.json({ isNew: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/login-step-2', async (req, res) => {
    try {
        const { firstName, lastName, password, subject } = req.body;
        const Teacher = mongoose.model('Teacher');
        const SECRET_CODE = "Clemenceau1919";

        let teacher = await Teacher.findOne({ 
            firstName: new RegExp('^' + firstName + '$', 'i'), 
            lastName: new RegExp('^' + lastName + '$', 'i') 
        });

        if (!teacher) {
            if (password !== SECRET_CODE) return res.status(401).json({ ok: false, message: "Code incorrect" });
            if (!subject) return res.json({ ok: true, needsSubject: true });
            
            const sections = subject.split(',').map(s => ({ name: s.trim(), color: '#ef4444' }));
            teacher = await Teacher.create({ firstName, lastName, password, subjectSections: sections });
        } else {
            if (password !== teacher.password && password !== SECRET_CODE) {
                return res.status(401).json({ ok: false, message: "Mot de passe incorrect" });
            }
        }

        res.json({ 
            ok: true, 
            user: { 
                id: teacher._id, 
                firstName: teacher.firstName, 
                lastName: teacher.lastName, 
                subjectSections: teacher.subjectSections, // ON RENVOIE LES SECTIONS ICI
                role: 'prof' 
            } 
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;