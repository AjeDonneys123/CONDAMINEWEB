const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/**
 * 📄 DOMAINE : HOMEWORK
 */

router.get('/all', async (req, res) => {
    try { res.json(await mongoose.model('Homework').find({}).sort({ date: -1 })); } catch (e) { res.status(500).json([]); }
});

router.get('/by-class/:classroom', async (req, res) => {
    try {
        const data = await mongoose.model('Homework').find({ 
            $or: [{ classroom: req.params.classroom }, { classroom: "Toutes" }] 
        }).sort({ date: -1 });
        res.json(data || []);
    } catch(e) { res.status(500).json([]); }
});

router.post('/', async (req, res) => {
    try {
        const { _id, ...data } = req.body;
        if (_id) return res.json(await mongoose.model('Homework').findByIdAndUpdate(_id, data, { new: true }));
        res.json(await mongoose.model('Homework').create(data));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;