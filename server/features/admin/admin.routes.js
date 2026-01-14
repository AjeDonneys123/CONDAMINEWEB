const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/**
 * 🏢 DOMAINE ADMIN : Point d'entrée pour les listes et structures
 */

router.get('/players', async (req, res) => {
    try {
        const data = await mongoose.model('Player').find({}).sort({ classroom: 1, lastName: 1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

router.get('/chapters-all', async (req, res) => {
    try {
        const data = await mongoose.model('Chapter').find({}).sort({ _id: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id } = req.body;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            return res.json(await mongoose.model('Chapter').findByIdAndUpdate(_id, req.body, { new: true }));
        }
        res.json(await mongoose.model('Chapter').create({ ...req.body, isArchived: false }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/classroom/:className', async (req, res) => {
    try {
        const { className } = req.params;
        await mongoose.model('Player').deleteMany({ classroom: className });
        await mongoose.model('Chapter').deleteMany({ classroom: className });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/bugs', async (req, res) => {
    try { res.json(await mongoose.model('Bug').find({}).sort({ createdAt: -1 })); } catch (e) { res.json([]); }
});

module.exports = router;