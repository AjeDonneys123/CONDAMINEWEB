




const express = require('express');
const router = express.Router();
const StructureDrive = require('./experts/structure.drive');
const mongoose = require('mongoose');

router.get('/chapters', async (req, res) => {
    try {
        const chapters = await mongoose.model('Chapter').find({})
            .populate('subjectId')
            .populate('classId')
            .sort({ createdAt: -1 })
            .lean();
        res.json(chapters);
    } catch (e) { res.status(500).json([]); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { title, subjectId, classId, teacherId } = req.body;
        
        const year = await mongoose.model('AcademicYear').findOne({ isCurrent: true });
        if (!year) return res.status(400).json({ error: "Aucune année scolaire active" });

        // 1. Sauvegarde BDD
        const chapter = await mongoose.model('Chapter').create({
            title: title.toUpperCase(),
            subjectId,
            classId,
            teacherId,
            yearId: year._id
        });

        // 2. Création Drive en tâche de fond
        StructureDrive.createFullHierarchy(chapter._id).catch(e => console.error("Drive Error:", e));

        res.json(chapter);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/chapters/:id', async (req, res) => {
    try {
        await mongoose.model('Chapter').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;




