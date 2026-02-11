// @signatures: EleveHomework, list, submit
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const EleveAI = require('../core/eleve.ai');

/**
 * 📝 RÉCUPÉRATION DES DEVOIRS (FIX V101)
 */
router.get('/list/:studentId', async (req, res) => {
    try {
        const Student = mongoose.model('Student');
        const Homework = mongoose.model('Homework');

        const student = await Student.findById(req.params.studentId).lean();
        if (!student) return res.json([]);

        const myClass = (student.currentClass || "").trim().toUpperCase();

        // On cherche les devoirs pour toute la classe OU assignés à Julian
        const homeworks = await Homework.find({
            $or: [
                { targetClassrooms: myClass, isAllClass: true },
                { assignedStudents: student._id }
            ]
        }).sort({ date: -1 }).lean();

        res.json(homeworks);
    } catch (e) {
        res.status(500).json([]);
    }
});

router.post('/submit', async (req, res) => {
    const { userText, homeworkId, levelIndex, playerId } = req.body;
    const Homework = mongoose.model('Homework');
    const Submission = mongoose.model('Submission');

    const hw = await Homework.findById(homeworkId);
    const lvl = hw.levels[levelIndex];

    const analysis = await EleveAI.analyze(userText, lvl.instruction, lvl.aiHints);
    
    await Submission.create({ 
        studentId: playerId, homeworkId, levelIndex, 
        content: userText, feedback: analysis.feedback_fond, grade: analysis.grade 
    });
    res.json(analysis);
});

module.exports = router;
