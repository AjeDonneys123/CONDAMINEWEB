const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// --- RÉCUPÉRER LES DEVOIRS PAR CLASSE ---
router.get('/homework/by-class/:classroom', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const list = await Homework.find({ 
            $or: [{ classroom: req.params.classroom }, { classroom: "Toutes" }] 
        }).sort({ date: -1 });
        res.json(list || []);
    } catch(e) { 
        console.error("Erreur devoirs classe:", e.message);
        res.status(500).json([]); 
    }
});

// --- RÉCUPÉRER LES FAUTES D'UN ÉLÈVE ---
router.get('/player-mistakes/:id', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        const player = await Player.findById(req.params.id);
        res.json(player ? player.spellingMistakes : []);
    } catch(e) { 
        res.status(500).json([]); 
    }
});

module.exports = router;