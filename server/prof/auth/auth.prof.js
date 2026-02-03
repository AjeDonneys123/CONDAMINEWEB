// @signatures: ProfAuth, login, config, finder, googleLogin, googleCallback
const express = require('express');
const router = express.Router();
const { Teacher, Admin, Student, Classroom } = require('../models/prof.models');
const ProfDrive = require('../core/drive.prof');
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

router.get('/finder-data', async (req, res) => {
    const list = await Student.find({}, 'firstName lastName currentClass').lean();
    res.json(list.map(s => ({ id: s._id, firstName: s.firstName, lastName: s.lastName, className: s.currentClass })));
});

// --- 🚀 NOUVELLES ROUTES OAUTH (FIX CANNOT GET) ---

router.get('/google/login', (req, res) => {
    try {
        const url = ProfDrive.getAuthUrl();
        res.redirect(url);
    } catch (e) {
        res.status(500).send("Erreur Init OAuth: " + e.message);
    }
});

router.get('/google/callback', async (req, res) => {
    try {
        const code = req.query.code;
        if (!code) return res.send("Pas de code reçu.");
        
        const tokens = await ProfDrive.getTokenFromCode(code);
        const refreshToken = tokens.refresh_token;

        if (!refreshToken) {
            return res.send(`
                <h1>⚠️ Pas de Refresh Token !</h1>
                <p>Google n'a renvoyé qu'un accès temporaire.</p>
                <p><strong>Solution :</strong> Supprimez l'accès à "Condamine" dans votre compte Google et réessayez.</p>
            `);
        }

        res.send(`
            <div style="font-family:sans-serif; padding:40px; text-align:center;">
                <h1 style="color:green">✅ NOUVEL ACCÈS CRÉÉ</h1>
                <p>Copiez ce code dans votre fichier <b>.env</b> :</p>
                <textarea style="width:100%; max-width:600px; height:100px; padding:10px; font-family:monospace;">${refreshToken}</textarea>
                <p style="color:red; font-weight:bold;">Redémarrez ensuite le serveur (Ctrl+C puis npm run dev).</p>
            </div>
        `);
    } catch (e) {
        res.status(500).send("Erreur Callback: " + e.message);
    }
});

module.exports = router;
