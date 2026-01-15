const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

router.get('/all', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const data = await Homework.find({}).sort({ date: -1 });
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ error: "Erreur lecture devoirs", details: e.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const { _id, ...data } = req.body;
        const result = _id ? await Homework.findByIdAndUpdate(_id, data, { new: true }) : await Homework.create(data);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: "Erreur sauvegarde", details: e.message });
    }
});

// US #9 : SUPPRESSION INTÉGRALE (BDD + DRIVE)
router.delete('/:id', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const hw = await Homework.findById(req.params.id);
        if (hw && hw.driveFolderId) {
            await DriveService.deleteEntity(hw.driveFolderId);
        }
        await Homework.findByIdAndDelete(req.params.id);
        res.json({ ok: true, message: "Devoir supprimé" });
    } catch (e) {
        console.error("❌ Delete Error:", e.message);
        res.status(500).json({ error: "Échec de suppression", details: e.message });
    }
});

module.exports = router;