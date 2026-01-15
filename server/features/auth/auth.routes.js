const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// ROUTE DE DIAGNOSTIC ET LOGIN
router.get('/google/login', (req, res) => {
    const url = DriveService.getAuthUrl();
    if (!url) {
        return res.status(500).send(`
            <div style="font-family:sans-serif; padding:50px; border:3px solid red; border-radius:30px; max-width:800px; margin: 40px auto; background: #fff1f2; text-align:center;">
                <h1 style="color:#b91c1c;">🚨 CONFIGURATION INVISIBLE</h1>
                <p>Le serveur ne parvient toujours pas à lire <b>GOOGLE_CLIENT_ID</b>.</p>
                
                <div style="background:white; padding:20px; border-radius:15px; border: 1px solid #fecaca; margin: 20px 0; text-align:left;">
                    <p><b>Diagnostic Système :</b></p>
                    <ul>
                        <li><b>CWD (Dossier actuel) :</b> ${process.cwd()}</li>
                        <li><b>Variables lues :</b> ${Object.keys(process.env).filter(k => k.startsWith('GOOGLE')).join(', ') || 'AUCUNE'}</li>
                    </ul>
                </div>

                <p>Si tu viens de créer le fichier <b>.env</b>, clique sur le bouton ci-dessous :</p>
                <a href="/api/auth/google/login" style="display:inline-block; padding:15px 30px; background:#b91c1c; color:white; text-decoration:none; border-radius:10px; font-weight:bold;">RECHARGER LA CONFIGURATION</a>
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
            <div style="font-family:sans-serif; padding:50px; text-align:center;">
                <h1 style="color:#059669;">Nouveau Token Généré !</h1>
                <p>Copie cette valeur et mets à jour ton <b>.env</b> :</p>
                <textarea style="width:100%; height:80px; font-family:monospace; padding:15px; border-radius:10px; border:1px solid #ccc; background:#f9fafb;" readonly>${refreshToken}</textarea>
                <p>Ensuite, <b>redémarre manuellement ton serveur</b>.</p>
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