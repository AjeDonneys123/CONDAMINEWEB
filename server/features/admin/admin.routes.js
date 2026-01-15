const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Helper pour éviter le crash si une collection n'est pas encore créée
async function safeFind(modelName) {
    try {
        const Model = mongoose.model(modelName);
        return await Model.find({}).lean();
    } catch (e) {
        return [];
    }
}

router.get('/database-dump', async (req, res) => {
    try {
        const dump = {
            players: await safeFind('Player'),
            chapters: await safeFind('Chapter'),
            homeworks: await safeFind('Homework'),
            gamelevels: await safeFind('GameLevel'),
            teachers: await safeFind('Teacher'),
            scansessions: await safeFind('ScanSession'),
            submissions: await safeFind('Submission'),
            bugs: await safeFind('Bug'),
            deploysignals: await safeFind('DeploySignal')
        };
        res.json(dump);
    } catch (e) {
        console.error("❌ Dump Error:", e.message);
        res.status(500).json({ error: "Erreur lors de l'extraction des données", details: e.message });
    }
});

router.get('/players', async (req, res) => {
    try {
        const players = await mongoose.model('Player').find({}).sort({ classroom: 1 });
        res.json(players);
    } catch (e) {
        res.status(500).json([]);
    }
});

module.exports = router;