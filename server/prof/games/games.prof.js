// @signatures: ProfGamesRouter, all, save, uploadAsset, generateContent, getTestData
const express = require('express');
const router = express.Router();
const { GameLevel, Chapter } = require('../models/prof.models');
const mongoose = require('mongoose');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/all', asyncHandler(async (req, res) => {
    res.json(await GameLevel.find({}).lean());
}));

router.get('/test-data', asyncHandler(async (req, res) => {
    const testGame = await GameLevel.findOne({ isTestGame: true }).sort({ updatedAt: -1 }).lean();
    res.json(testGame || null);
}));

// --- SAUVEGARDE MIROIR (V105) ---
router.post('/', asyncHandler(async (req, res) => {
    const data = { ...req.body };
    const teacherId = data.teacherId;

    if (!data._id || data._id === "" || data._id === "null") delete data._id;

    // SÉCURITÉ CHAPITRE
    if (!data.chapterId || !mongoose.Types.ObjectId.isValid(data.chapterId)) {
        let fallback = await Chapter.findOne({ teacherId, section: "GÉNÉRAL", title: "GÉNÉRAL" });
        if (!fallback) fallback = await Chapter.create({ title: "GÉNÉRAL", section: "GÉNÉRAL", teacherId });
        data.chapterId = fallback._id;
    }

    // MISE À JOUR OU CRÉATION
    // On s'assure que 'scenes' et 'generatedCode' sont bien inclus dans le payload
    let result;
    if (data._id) {
        result = await GameLevel.findByIdAndUpdate(data._id, { $set: data }, { new: true });
    } else {
        result = await GameLevel.create(data);
    }
    res.json(result);
}));

module.exports = router;
