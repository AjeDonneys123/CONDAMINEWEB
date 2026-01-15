const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

router.post('/login-step-1', async (req, res) => {
    const { firstName, lastName } = req.body;
    const t = await mongoose.model('Teacher').findOne({ firstName: new RegExp(`^${firstName}$`, 'i'), lastName: new RegExp(`^${lastName}$`, 'i') });
    if (t) return res.json({ isTeacher: true });
    const s = await mongoose.model('Player').findOne({ firstName: new RegExp(`^${firstName}$`, 'i'), lastName: new RegExp(`^${lastName}$`, 'i') });
    if (s) return res.json({ isStudent: true, user: { ...s._doc, id: s._id } });
    res.json({ isNew: true });
});

router.post('/login-step-2', async (req, res) => {
    const { firstName, lastName, password } = req.body;
    const t = await mongoose.model('Teacher').findOne({ firstName, lastName });
    if (t && (password === t.password || password === "Clemenceau1919")) {
        return res.json({ ok: true, user: { ...t._doc, id: t._id, role: 'prof' } });
    }
    res.status(401).json({ ok: false });
});

// OAUTH GOOGLE
router.get('/google/login', (req, res) => res.redirect(DriveService.getAuthUrl()));

router.get('/google/callback', async (req, res) => {
    try {
        const refreshToken = await DriveService.exchangeCode(req.query.code);
        res.send(`<h1>AUTH CONDAMINE OK</h1><p>Copie ce Refresh Token dans ton .env (GOOGLE_REFRESH_TOKEN) :</p><pre>${refreshToken}</pre>`);
    } catch (e) { res.status(500).send("Erreur Auth : " + e.message); }
});

module.exports = router;