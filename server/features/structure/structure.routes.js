const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.get('/chapters', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const data = await Chapter.find({});
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ error: "Erreur lecture dossiers", details: e.message });
    }
});

module.exports = router;