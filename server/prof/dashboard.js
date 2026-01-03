const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// GESTION BUGS
router.get('/bugs', async (req, res) => {
    try {
        console.log("🐞 [PROF] Récupération de la liste des bugs...");
        const bugs = await mongoose.model('Bug').find({}).sort({ date: -1 });
        console.log(`✅ [PROF] ${bugs.length} bugs trouvés.`);
        res.json(bugs);
    } catch (e) {
        console.error("❌ [PROF] Erreur lecture bugs :", e);
        res.status(500).json([]);
    }
});

router.delete('/bugs/:id', async (req, res) => {
    try {
        await mongoose.model('Bug').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false }); }
});

router.post('/report-bug', async (req, res) => {
    try {
        await mongoose.model('Bug').create(req.body);
        console.log("✅ [BUG] Nouveau signalement enregistré.");
        res.json({ ok: true });
    } catch(e) {
        console.error("❌ [BUG] Erreur sauvegarde :", e);
        res.status(500).json({ok: false});
    }
});

// GESTION ÉLÈVES
router.get('/players', async (req, res) => {
    try {
        const players = await mongoose.model('Player').find({}).sort({ classroom: 1, lastName: 1 });
        res.json(players);
    } catch(e) { console.error(e); res.status(500).json([]); }
});

router.post('/reset-player', async (req, res) => {
    await mongoose.model('Player').findByIdAndUpdate(req.body.playerId, { validatedQuestions: [], validatedLevels: [], spellingMistakes: [] });
    res.json({ ok: true });
});

module.exports = router;