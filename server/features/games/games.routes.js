const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.get('/all', async (req, res) => {
    try {
        res.json(await mongoose.model('GameLevel').find({}));
    } catch (e) { res.status(500).json([]); }
});

router.post('/', async (req, res) => {
    const { _id, ...data } = req.body;
    const r = _id ? await mongoose.model('GameLevel').findByIdAndUpdate(_id, data, { new: true }) : await mongoose.model('GameLevel').create(data);
    res.json(r);
});

router.delete('/:id', async (req, res) => {
    try {
        await mongoose.model('GameLevel').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;