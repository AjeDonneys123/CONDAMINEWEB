const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const StructureService = require('../../services/structure.service');

/**
 * 📂 ROUTER : STRUCTURE
 * Risque réduit : Délègue la création complexe à StructureService.
 */

router.get('/chapters', async (req, res) => {
    try { res.json(await mongoose.model('Chapter').find({}).lean()); } catch (e) { res.status(500).json([]); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { teacherId, classroom, subject, title, _id } = req.body;
        const result = await StructureService.createChapter(teacherId, classroom, subject, title, _id);
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/chapters/archive', async (req, res) => {
    try {
        await mongoose.model('Chapter').findByIdAndUpdate(req.body.id, { isArchived: req.body.isArchived });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/chapters/:id', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const chap = await Chapter.findById(req.params.id);
        if (chap?.driveFolderId) {
            const DriveService = require('../../services/drive.service');
            await DriveService.deleteEntity(chap.driveFolderId);
        }
        await Chapter.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;