// @signatures: EleveGames, list, score
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/**
 * 🎮 RÉCUPÉRATION DES JEUX POUR L'ÉLÈVE (FIX JULIAN)
 */
router.get('/list/:studentId', async (req, res) => {
    try {
        const Student = mongoose.model('Student');
        const GameLevel = mongoose.model('GameLevel');
        
        const student = await Student.findById(req.params.studentId).lean();
        if (!student) return res.json([]);

        const myClass = (student.currentClass || "").trim().toUpperCase();
        // On récupère aussi les IDs des groupes auxquels il appartient
        const myGroups = (student.assignedGroups || []).map(g => String(g));

        // Julian voit le jeu si :
        // 1. Sa classe est dans targetClassrooms
        // 2. OU il est spécifiquement dans assignedStudents
        // 3. OU un de ses groupes est dans targetClassrooms (cas des options)
        const query = {
            $or: [
                { targetClassrooms: myClass, isAllClass: true },
                { assignedStudents: student._id },
                { targetClassrooms: { $in: myClass } } // Match simple
            ]
        };

        const games = await GameLevel.find(query).sort({ createdAt: -1 }).lean();
        
        // Log pour debug si Julian est vide
        if (games.length === 0) {
            console.log(`🔎 [GAMES-DEBUG] Aucun jeu trouvé pour ${student.firstName} (${myClass})`);
        }

        res.json(games);
    } catch (e) {
        console.error("❌ [GAMES-ELEVE] Error:", e.message);
        res.status(500).json([]);
    }
});

router.post('/score', async (req, res) => {
    const { studentId, gameId, score } = req.body;
    await mongoose.model('GameProgress').findOneAndUpdate(
        { studentId, gameId }, 
        { lastScore: score, levelReached: 1 }, 
        { upsert: true }
    );
    res.json({ ok: true });
});

module.exports = router;
