const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// ROUTE REPARATION DRIVE
router.get('/google/login', (req, res) => {
    const url = DriveService.getAuthUrl();
    if (!url) return res.status(500).send("Erreur: Variables .env manquantes (ID ou Secret)");
    res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
    try {
        const code = req.query.code;
        const refreshToken = await DriveService.setTokenFromCode(code);
        res.send(`
            <div style="font-family:sans-serif; padding:50px; text-align:center;">
                <h1 style="color:#22c55e;">Clé Google Drive Réparée !</h1>
                <p>Copie cette valeur et colle-la dans ton <b>.env</b> :</p>
                <textarea style="width:100%; height:80px; font-family:monospace; padding:15px; border-radius:10px; border:1px solid #ccc; background:#f9fafb;" readonly>${refreshToken}</textarea>
                <p>Enregistre le .env et <b>redémarre ton terminal</b>.</p>
            </div>
        `);
    } catch (e) { res.status(500).send("Erreur Callback : " + e.message); }
});

router.post('/login-step-1', async (req, res) => {
    try {
        const { firstName, lastName } = req.body;
        const teacher = await mongoose.model('Teacher').findOne({ firstName: new RegExp('^' + firstName + '$', 'i'), lastName: new RegExp('^' + lastName + '$', 'i') });
        if (teacher) return res.json({ isTeacher: true });
        const student = await mongoose.model('Player').findOne({ firstName: new RegExp('^' + firstName + '$', 'i'), lastName: new RegExp('^' + lastName + '$', 'i') });
        if (student) return res.json({ isStudent: true, user: { ...student._doc, id: student._id } });
        res.json({ isNew: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/login-step-2', async (req, res) => {
    try {
        const { firstName, lastName, password, subject } = req.body;
        const SECRET_CODE = "Clemenceau1919";
        let teacher = await mongoose.model('Teacher').findOne({ firstName: new RegExp('^' + firstName + '$', 'i'), lastName: new RegExp('^' + lastName + '$', 'i') });
        if (!teacher) {
            if (password !== SECRET_CODE) return res.status(401).json({ ok: false, message: "Code incorrect" });
            if (!subject) return res.json({ ok: true, needsSubject: true });
            const sections = subject.split(',').map(s => ({ name: s.trim(), color: '#ef4444' }));
            teacher = await mongoose.model('Teacher').create({ firstName, lastName, password, subjectSections: sections });
        } else if (password !== teacher.password && password !== SECRET_CODE) {
            return res.status(401).json({ ok: false, message: "Mot de passe incorrect" });
        }
        res.json({ ok: true, user: { id: teacher._id, firstName: teacher.firstName, lastName: teacher.lastName, subjectSections: teacher.subjectSections, role: 'prof' } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;