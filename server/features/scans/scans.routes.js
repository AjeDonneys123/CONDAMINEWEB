const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.get('/sessions', async (req, res) => {
    res.json(await mongoose.model('ScanSession').find({}));
});

module.exports = router;