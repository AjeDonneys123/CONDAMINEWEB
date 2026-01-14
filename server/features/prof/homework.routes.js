const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const getHomework = () => mongoose.model('Homework');

router.get('/homework-all', async (req, res) => {
    try {
        const data = await getHomework().find({}).sort({ date: -1 });
        res.json(data);
    } catch (e) { res.status(500).json([]); }
});

router.post('/homework', async (req, res) => {
    try {
        const { _id, ...data } = req.body;
        if (_id) await getHomework().findByIdAndUpdate(_id, data);
        else await getHomework().create(data);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/homework/:id', async (req, res) => {
    try {
        await getHomework().findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;