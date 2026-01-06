const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// FIX 404 : On change le préfixe pour ne pas confondre ID et Classe
router.get('/homework/by-class/:classroom', async (req, res) => {
    try {
        const list = await mongoose.model('Homework').find({ 
            $or: [{ classroom: req.params.classroom }, { classroom: "Toutes" }] 
        }).sort({ date: -1 });
        res.json(list);
    } catch(e) { res.status(500).json([]); }
});

module.exports = router;