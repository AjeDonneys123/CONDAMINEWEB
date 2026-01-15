const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');
const AIService = require('../../services/ai.service');

router.get('/all', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const data = await Homework.find({}).sort({ date: -1 });
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ error: "Erreur lecture devoirs" });
    }
});

router.post('/analyze-homework', async (req, res) => {
    try {
        const { userText, homeworkInstruction, classroom, playerId, homeworkId, levelIndex } = req.body;
        const style = await mongoose.model('TeacherStyle').findOne({ teacherId: "jean_vuillet" });
        const analysis = await AIService.analyzeSubmission(userText, homeworkInstruction, classroom, style?.pedagogicalMemory || "");
        
        if (playerId) {
            await mongoose.model('Player').findByIdAndUpdate(playerId, {
                $push: { spellingMistakes: { $each: analysis.corrections || [] } }
            });
        }
        await mongoose.model('Submission').create({ playerId, homeworkId, levelIndex, originalTranscription: userText, feedback: analysis.feedback_fond, grade: analysis.grade });
        res.json(analysis);
    } catch (e) {
        res.status(500).json({ error: "Échec analyse IA" });
    }
});

router.post('/', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const { _id, ...data } = req.body;
        const r = _id ? await Homework.findByIdAndUpdate(_id, data, { new: true }) : await Homework.create(data);
        res.json(r);
    } catch (e) {
        res.status(500).json({ error: "Sauvegarde échouée" });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const hw = await Homework.findById(req.params.id);
        if (hw?.driveFolderId) await DriveService.deleteEntity(hw.driveFolderId);
        await Homework.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: "Suppression impossible" });
    }
});

module.exports = router;