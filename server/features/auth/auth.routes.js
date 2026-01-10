const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// --- ÉTAPE 1 : IDENTIFICATION ---
router.post('/login-step-1', async (req, res) => {
    try {
        const { firstName, lastName } = req.body;
        const Teacher = mongoose.model('Teacher');
        const Player = mongoose.model('Player');

        // 1. Chercher si c'est un prof connu
        const teacher = await Teacher.findOne({ 
            firstName: new RegExp(`^${firstName}$`, 'i'), 
            lastName: new RegExp(`^${lastName}$`, 'i') 
        });
        if (teacher) return res.json({ isTeacher: true });

        // 2. Chercher si c'est un élève connu
        const student = await Player.findOne({ 
            firstName: new RegExp(`^${firstName}$`, 'i'), 
            lastName: new RegExp(`^${lastName}$`, 'i') 
        });
        if (student) return res.json({ isStudent: true, user: { ...student._doc, id: student._id } });

        // 3. Sinon, c'est peut-être un nouveau prof
        res.json({ isNew: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ÉTAPE 2 : VALIDATION / CRÉATION ---
router.post('/login-step-2', async (req, res) => {
    try {
        const { firstName, lastName, password, subject } = req.body;
        const Teacher = mongoose.model('Teacher');
        const SECRET_CODE = "Clemenceau1919"; // Code pour devenir prof

        let teacher = await Teacher.findOne({ 
            firstName: new RegExp(`^${firstName}$`, 'i'), 
            lastName: new RegExp(`^${lastName}$`, 'i') 
        });

        // Cas Nouveau Prof
        if (!teacher) {
            if (password !== SECRET_CODE) return res.status(401).json({ ok: false, message: "Code secret incorrect" });
            if (!subject) return res.json({ ok: true, needsSubject: true });
            
            teacher = await Teacher.create({ firstName, lastName, password, subject });
        } else {
            // Cas Prof connu
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
                subject: teacher.subject, 
                role: 'prof' 
            } 
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;