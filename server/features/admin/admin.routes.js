const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

async function safeFind(modelName) {
    try {
        const Model = mongoose.model(modelName);
        return await Model.find({}).lean();
    } catch (e) {
        console.warn(`⚠️ Collection ${modelName} non initialisée.`);
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
        res.status(500).json({ error: "Crash du Dump", details: e.message });
    }
});

router.get('/players', async (req, res) => {
    try {
        res.json(await mongoose.model('Player').find({}).sort({ classroom: 1 }));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;