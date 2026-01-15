const express = require('express');
const router = express.Router();
const StructureService = require('../../services/structure.service');

/**
 * 📂 ROUTER : STRUCTURE (POROSITÉ ZÉRO)
 * Mission : Déléguer la création de dossiers BDD+Drive au Service.
 */

router.get('/chapters', async (req, res) => {
    const mongoose = require('mongoose');
    try { res.json(await mongoose.model('Chapter').find({}).lean()); } catch (e) { res.status(500).json([]); }
});

router.post('/chapters', async (req, res) => {
    try {
        const result = await StructureService.createChapter(req.body);
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/chapters/:id', async (req, res) => {
    try {
        await StructureService.deleteChapter(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;