const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const HomeworkService = require('../../services/homework.service');

router.get('/all', async (req, res) => {
    try { res.json(await mongoose.model('Homework').find({}).sort({ date: -1 })); } catch (e) { res.status(500).json([]); }
});
router.post('/analyze-homework', async (req, res) => {
    try { const analysis = await HomeworkService.processSubmission(req.body); res.json(analysis); } catch (e) { res.status(500).json({ error: "Analysis failed" }); }
});
router.post('/', async (req, res) => {
    try { const result = await HomeworkService.createHomework(req.body, req.body.teacherId); res.json(result); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/:id', async (req, res) => {
    try {
        const hw = await mongoose.model('Homework').findById(req.params.id);
        if (hw?.driveFolderId) {
            const DriveService = require('../../services/drive.service');
            await DriveService.deleteEntity(hw.driveFolderId);
        }
        await mongoose.model('Homework').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;