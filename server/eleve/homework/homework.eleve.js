// @signatures: EleveHomework, list, submit
const express = require('express');
const router = express.Router();
const { Homework, Student, Submission } = require('../models/eleve.models');
const EleveAI = require('../core/eleve.ai');

router.get('/list/:studentId', async (req, res) => {
    const student = await Student.findById(req.params.studentId).lean();
    if (!student) return res.json([]);
    const myClass = (student.currentClass || "").toUpperCase();
    res.json(await Homework.find({
        $or: [{ assignedStudents: student._id }, { targetClassrooms: myClass, isAllClass: true }]
    }).lean());
});

router.post('/submit', async (req, res) => {
    const { userText, homeworkId, levelIndex, playerId } = req.body;
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
