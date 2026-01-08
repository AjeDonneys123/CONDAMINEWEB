const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// On s'assure que ces routes renvoient TOUJOURS du JSON, même vide.
router.get('/chapters-all', async (req, res) => {
    try {
        const chapters = await mongoose.model('Chapter').find({});
        res.json(chapters || []);
    } catch (e) { 
        res.json([]); 
    }
});

router.get('/homework-all', async (req, res) => {
    try {
        const list = await mongoose.model('Homework').find({}).sort({ date: -1 });
        res.json(list || []);
    } catch (e) { 
        res.json([]); 
    }
});

router.get('/players', async (req, res) => {
    try {
        const players = await mongoose.model('Player').find({});
        res.json(players || []);
    } catch (e) { 
        res.json([]); 
    }
});

module.exports = router;