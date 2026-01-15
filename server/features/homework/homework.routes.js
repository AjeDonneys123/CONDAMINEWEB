const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');
const AIService = require('../../services/ai.service');

/**
 * 📄 DOMAINE : DEVOIRS
 * Mission : Uniquement la gestion des Homeworks et leur analyse.
 * Découplage : La sauvegarde des fautes est déléguée au modèle Player.
 */

router.get('/all', async (req, res) => {
    try {
        const data = await mongoose.model('Homework').find({}).sort({ date: -1 });
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/analyze-homework', async (req, res) => {
    try {
        const { userText, homeworkInstruction, classroom, playerId, homeworkId, levelIndex } = req.body;
        const style = await mongoose.model('TeacherStyle').findOne({ teacherId: "jean_vuillet" });
        const analysis = await AIService.analyzeSubmission(userText, homeworkInstruction, classroom, style?.pedagogicalMemory || "");
        
        // US#11 : Archivage des fautes (Logique isolée)
        if (playerId && analysis.corrections) {
            await mongoose.model('Player').findByIdAndUpdate(playerId, {
                $push: { spellingMistakes: { $each: analysis.corrections } }
            });
        }
        
        await mongoose.model('Submission').create({ 
            playerId, homeworkId, levelIndex, 
            originalTranscription: userText, 
            feedback: analysis.feedback_fond, 
            grade: analysis.grade 
        });
        res.json(analysis);
    } catch (e) { res.status(500).json({ error: "Erreur Analyse IA" }); }
});

router.delete('/:id', async (req, res) => {
    try {
        const hw = await mongoose.model('Homework').findById(req.params.id);
        if (hw?.driveFolderId) await DriveService.deleteEntity(hw.driveFolderId);
        await mongoose.model('Homework').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: "Erreur suppression" }); }
});

module.exports = router;