const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.get('/database-dump', async (req, res) => {
    res.json({
        players: await mongoose.model('Player').find({}),
        chapters: await mongoose.model('Chapter').find({}),
        homeworks: await mongoose.model('Homework').find({}),
        gamelevels: await mongoose.model('GameLevel').find({}),
        teachers: await mongoose.model('Teacher').find({}),
        scansessions: await mongoose.model('ScanSession').find({}),
        bugs: await mongoose.model('Bug').find({}),
        deploysignals: await mongoose.model('DeploySignal').find({})
    });
});

router.get('/players', async (req, res) => {
    res.json(await mongoose.model('Player').find({}).sort({ classroom: 1 }));
});

module.exports = router;