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
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            const updated = await Homework.findByIdAndUpdate(_id, data, { new: true });
            return res.json(updated);
        }
        const created = await Homework.create(data);
        res.json(created);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/by-class/:classroom', async (req, res) => {
    try {
        const data = await mongoose.model('Homework').find({ 
            $or: [{ classroom: req.params.classroom }, { classroom: "Toutes" }] 
        }).sort({ date: -1 });
        res.json(data || []);
    } catch(e) { res.status(500).json([]); }
});

module.exports = router;