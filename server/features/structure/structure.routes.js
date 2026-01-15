const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.get('/chapters', async (req, res) => {
    res.json(await mongoose.model('Chapter').find({}));
});

module.exports = router;