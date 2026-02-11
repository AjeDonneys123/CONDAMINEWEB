// @signatures: EleveGames, list, score
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/**
 * 🎮 RÉCUPÉRATION DES JEUX (VERSION ULTRA-PERMISSIVE V102)
 */
router.get('/list/:studentId', async (req, res) => {
    try {
        const Student = mongoose.model('Student');
        const GameLevel = mongoose.model('GameLevel');
        
        const student = await Student.findById(req.params.studentId).lean();
        if (!student) return res.json([]);

        // On nettoie la classe de Julian (ex: " 6D " -> "6D")
        const myClass = (student.currentClass || "").trim().toUpperCase();

        // REQUÊTE ÉLARGIE :
        const query = {
            $or: [
                // 1. Julian est spécifiquement invité par son ID
                { assignedStudents: student._id },
                // 2. La classe de Julian est dans la liste des cibles
                { targetClassrooms: myClass },
                // 3. Cas particulier : c'est un jeu de test (pour que tu puisses voir tes créations)
                { isTestGame: true }
            ]
        };

        const games = await GameLevel.find(query).sort({ updatedAt: -1 }).lean();
        
        console.log(`🔎 [GAMES] ${games.length} jeux trouvés pour ${student.firstName} (${myClass})`);
        res.json(games);
    } catch (e) {
        console.error("❌ [GAMES-ELEVE] Error:", e.message);
        res.status(500).json([]);
    }
});

router.post('/score', async (req, res) => {
    const { studentId, gameId, score, levelReached } = req.body;
    const GameProgress = mongoose.model('GameProgress');
    await GameProgress.findOneAndUpdate(
        { studentId, gameId }, 
        { lastScore: score, levelReached: levelReached || 1, updatedAt: new Date() }, 
        { upsert: true }
    );
    res.json({ ok: true });
});

module.exports = router;
