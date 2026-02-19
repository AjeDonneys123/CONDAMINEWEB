const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// 1. Liste des activités Jeux (Leçons/Quizz) assignées à l'élève
// CORRECTION : Nettoyage de la classe (5B vs 5 B) pour William
router.get('/list/:studentId', async (req, res) => {
    try {
        const Student = mongoose.model('Student');
        const GameLevel = mongoose.model('GameLevel');
        
        const student = await Student.findById(req.params.studentId).lean();
        if (!student) return res.json([]);

        const myClassRaw = (student.currentClass || "").trim().toUpperCase();
        const myClassClean = myClassRaw.replace(/\s+/g, ''); 

        // On cherche les activités qui visent soit le nom brut, soit le nom nettoyé
        const games = await GameLevel.find({
            $or: [
                { targetClassrooms: myClassRaw, isAllClass: true },
                { targetClassrooms: myClassClean, isAllClass: true },
                { assignedStudents: student._id }
            ]
        }).sort({ createdAt: -1 }).lean();

        res.json(games);
    } catch (e) { 
        console.error("Erreur list games élève:", e);
        res.status(500).json([]); 
    }
});

// 2. Liste des univers (Skins/Modalités) créés dans le Studio
router.get('/skins', async (req, res) => {
    try {
        const StudioProject = mongoose.model('StudioProject');
        const projects = await StudioProject.find({}, 'title scenes generatedCode').sort({ updatedAt: -1 }).lean();
        res.json(projects);
    } catch (e) { res.status(500).json([]); }
});

module.exports = router;