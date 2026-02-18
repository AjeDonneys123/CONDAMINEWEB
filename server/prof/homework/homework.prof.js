// @signatures: ProfHomeworkRouter, listAll
const express = require('express');
const router = express.Router();
const { Homework } = require('../models/prof.models');

/**
 * 📝 BLOC DEVOIRS PROF (/api/homework)
 */

router.get('/all', async (req, res) => {
    try {
        const list = await Homework.find({}).sort({ date: -1 }).lean();
        res.json(list);
    } catch (e) { res.status(500).json({ error: "DB FAIL" }); }
});

router.post('/', async (req, res) => {
    try {
        const hw = await Homework.create(req.body);
        res.json(hw);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
