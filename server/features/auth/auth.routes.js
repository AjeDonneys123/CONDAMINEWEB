const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// US #8 : REPARATION OAUTH (ANTI-400)
router.get('/google/login', (req, res) => {
    const url = DriveService.getAuthUrl();
    if (!url) {
        return res.status(500).send(`
            <div style="font-family:sans-serif; padding:50px; border:3px solid red; border-radius:30px; max-width:800px; margin: 40 auto; background: #fff1f2;">
                <h1 style="color:#b91c1c;">🚨 ERREUR PARAMÈTRES OAUTH</h1>
                <p>Google rejette la demande car des paramètres sont manquants ou invalides.</p>
                <div style="background:white; padding:20px; border-radius:15px; border: 1px solid #fecaca; margin: 20px 0;">
                    <p><b>Statut de vos variables .env :</b></p>
                    <ul style="font-family:monospace;">
                        <li>GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? '✅ OK' : '❌ MANQUANT'}</li>
                        <li>GOOGLE_CLIENT_SECRET: ${process.env.GOOGLE_CLIENT_SECRET ? '✅ OK' : '❌ MANQUANT'}</li>
                        <li>GOOGLE_REDIRECT_URI: ${process.env.GOOGLE_REDIRECT_URI ? '✅ OK' : '❌ MANQUANT (Utilisez http://localhost:3000/api/auth/google/callback)'}</li>
                    </ul>
                </div>
                <p>Une fois corrigé, <b>redémarrez le terminal</b>.</p>
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
                <h1 style="color:#059669;">Succès !</h1>
                <p>Copie ce nouveau token dans ton <b>.env</b> :</p>
                <textarea style="width:100%; height:80px; font-family:monospace; padding:15px; border-radius:10px; border:1px solid #ccc; background:#f9fafb;" readonly>${refreshToken}</textarea>
                <p>Puis <b>redémarre ton serveur</b>.</p>
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