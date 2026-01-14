const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/**
 * 📄 DOMAINE : HOMEWORK
 */

router.get('/all', async (req, res) => {
    try {
        const data = await mongoose.model('Homework').find({}).sort({ date: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

router.post('/', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const { _id, ...data } = req.body;
        if (_id) return res.json(await Homework.findByIdAndUpdate(_id, data, { new: true }));
        res.json(await Homework.create(data));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
    try {
        await mongoose.model('Homework').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;