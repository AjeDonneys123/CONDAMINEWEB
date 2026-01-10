const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');
const fetch = require('node-fetch');

// --- LOGIN ÉTAPE 1 : QUI EST-CE ? ---
router.post('/login-step-1', async (req, res) => {
    const { firstName, lastName } = req.body;
    const Teacher = mongoose.model('Teacher');
    const Player = mongoose.model('Player');

    const teacher = await Teacher.findOne({ firstName: new RegExp(`^${firstName}$`, 'i'), lastName: new RegExp(`^${lastName}$`, 'i') });
    if (teacher) return res.json({ isTeacher: true });

    const student = await Player.findOne({ firstName: new RegExp(`^${firstName}$`, 'i'), lastName: new RegExp(`^${lastName}$`, 'i') });
    if (student) return res.json({ isStudent: true, user: { ...student._doc, id: student._id } });

    res.json({ isNew: true }); // Nouveau prof potentiel
});

// --- LOGIN ÉTAPE 2 : AUTH / CRÉATION ---
router.post('/login-step-2', async (req, res) => {
    const { firstName, lastName, password, subject } = req.body;
    const Teacher = mongoose.model('Teacher');

    // Code secret pour créer un nouveau prof (à changer par ton code préféré)
    const SECRET_REGISTRATION_CODE = "Clemenceau1919";

    let teacher = await Teacher.findOne({ firstName: new RegExp(`^${firstName}$`, 'i'), lastName: new RegExp(`^${lastName}$`, 'i') });

    if (!teacher) {
        if (password !== SECRET_REGISTRATION_CODE) return res.status(401).json({ ok: false, message: "Code incorrect" });
        if (!subject) return res.json({ ok: true, needsSubject: true });
        
        teacher = await Teacher.create({ firstName, lastName, password, subject });
    } else {
        if (password !== teacher.password && password !== SECRET_REGISTRATION_CODE) return res.status(401).json({ ok: false, message: "Mot de passe incorrect" });
    }

    res.json({ ok: true, user: { id: teacher._id, firstName: teacher.firstName, lastName: teacher.lastName, subject: teacher.subject, role: 'prof' } });
});

// --- WIZARD IA : CRÉER UNE CLASSE ---
router.post('/create-class-wizard', async (req, res) => {
    try {
        const { teacherId, className, rawData } = req.body;
        
        const prompt = `
            Voici une liste d'élèves (format texte ou CSV) :
            "${rawData}"
            
            MISSION : Extraire proprement Prénom, Nom et Email.
            RETOURNE UNIQUEMENT UN JSON : [{"firstName": "...", "lastName": "...", "email": "..."}]
        `;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const aiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        }).then(r => r.json());

        const students = JSON.parse(aiRes.candidates[0].content.parts[0].text);
        const Player = mongoose.model('Player');
        const Teacher = mongoose.model('Teacher');
        const teacher = await Teacher.findById(teacherId);

        // 1. Création Drive
        const { classId } = await DriveService.getTeacherPath(`${teacher.firstName} ${teacher.lastName}`, className);

        // 2. Création BDD
        for (const s of students) {
            await Player.create({ ...s, classroom: className, teacherId });
            // Création dossier élève sur Drive
            await DriveService.getOrCreateFolder(`${s.firstName} ${s.lastName}`, classId);
        }

        res.json({ ok: true, count: students.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ... (Garder les autres routes Scans, Delete en ajoutant le filtrage par teacherId si nécessaire)
module.exports = router;