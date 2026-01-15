const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.get('/all', async (req, res) => {
    res.json(await mongoose.model('GameLevel').find({}));
});

router.post('/', async (req, res) => {
    const { _id, ...data } = req.body;
    const r = _id ? await mongoose.model('GameLevel').findByIdAndUpdate(_id, data, { new: true }) : await mongoose.model('GameLevel').create(data);
    res.json(r);
});

module.exports = router;