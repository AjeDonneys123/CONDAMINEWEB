const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Route robuste pour récupérer tous les quiz (indispensable pour l'affichage)
router.get('/game-levels/all', async (req, res) => {
    try { 
        const GameLevel = mongoose.model('GameLevel');
        const data = await GameLevel.find({}).sort({ _id: -1 });
        res.json(data || []); 
    } catch (e) { 
        console.error("❌ Erreur GET /game-levels/all:", e.message);
        res.status(500).json([]); 
    }
});

router.post('/game-levels', async (req, res) => {
    try {
        const GameLevel = mongoose.model('GameLevel');
        const { _id, ...data } = req.body;
        if (_id) await GameLevel.findByIdAndUpdate(_id, data);
        else await GameLevel.create(data);
        res.json({ ok: true });
    } catch(e) { res.status(500).json({error: e.message}); }
});

module.exports = router;