// @signatures: EleveStructure, getChapters
const express = require('express');
const router = express.Router();
const { Chapter } = require('../models/eleve.models');

/**
 * 🎒 LOGIQUE STRUCTURE ÉLÈVE : LECTURE SEULE
 */

router.get('/chapters', async (req, res) => {
    try {
        // L'élève ne voit que les dossiers non archivés
        const chapters = await Chapter.find({ isArchived: false }).lean();
        res.json(chapters);
    } catch (e) { res.json([]); }
});

module.exports = router;
