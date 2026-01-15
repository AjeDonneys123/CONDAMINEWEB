const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// REPARATION GOOGLE OAUTH
router.get('/google/login', (req, res) => {
    const url = DriveService.getAuthUrl();
    if (!url) {
        // Détails pour aider le prof à debug
        return res.status(500).send(`
            <div style="font-family:sans-serif; padding:40px; border:2px solid red; border-radius:20px; max-width:600px; margin: 40px auto;">
                <h1 style="color:red;">Erreur de configuration Google</h1>
                <p>Le serveur ne trouve pas les clés d'accès dans le fichier <b>.env</b>.</p>
                <p>Vérifie que ton fichier .env contient :</p>
                <pre style="background:#eee; padding:10px;">
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
                </pre>
            </div>
        `);
    }
    res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
    try {
        const code = req.query.code;
        const refreshToken = await DriveService.setTokenFromCode(code);
        res.send(`
            <div style="font-family:sans-serif; padding:40px; text-align:center;">
                <h1 style="color:#22c55e;">Clé générée !</h1>
                <p>Copie cette valeur dans ton <b>.env</b> :</p>
                <code style="display:block; background:#f1f5f9; padding:20px; border-radius:10px; word-break:break-all; border:1px solid #ccc;">${refreshToken}</code>
                <p>Puis <b>redémarre ton serveur</b> (le bouton Nuke fonctionnera).</p>
            </div>
        `);
    } catch (e) { res.status(500).send("Erreur callback: " + e.message); }
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