const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// --- CHAPITRES AVEC AUTO-REPARATION ---
router.get('/chapters-all', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        let chapters = await Chapter.find({});

        // LOGIQUE D'AUTO-REPARATION POUR LES ANCIENS DOSSIERS
        let hasFixed = false;
        for (let chap of chapters) {
            if (!chap.subject) {
                if (chap.title.includes('H')) chap.subject = 'H';
                else if (chap.title.includes('G')) chap.subject = 'G';
                else if (chap.title.includes('E')) chap.subject = 'E';
                else chap.subject = 'H'; // Par défaut
                await chap.save();
                hasFixed = true;
            }
        }
        if(hasFixed) chapters = await Chapter.find({}); // Recharger si modifs

        res.json(chapters);
    } catch (e) { res.status(500).json([]); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, ...data } = req.body;
        const Chapter = mongoose.model('Chapter');
        if (_id) {
            await Chapter.findByIdAndUpdate(_id, data);
        } else {
            // Création forcée
            const newChap = new Chapter(data);
            await newChap.save();
        }
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.delete('/chapters/:id', async (req, res) => {
    try {
        await mongoose.model('Chapter').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false }); }
});

module.exports = router;