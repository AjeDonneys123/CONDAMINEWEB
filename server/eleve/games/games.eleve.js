// 1. Liste des activités Jeux assignées à l'élève
router.get('/list/:studentId', async (req, res) => {
    try {
        const Student = mongoose.model('Student');
        const GameLevel = mongoose.model('GameLevel');
        const student = await Student.findById(req.params.studentId).lean();
        if (!student) return res.json([]);

        const myClass = (student.currentClass || "").trim().toUpperCase();
        const games = await GameLevel.find({
            $or: [
                { targetClassrooms: myClass, isAllClass: true },
                { assignedStudents: student._id }
            ]
        }).sort({ createdAt: -1 }).lean();

        res.json(games);
    } catch (e) { res.status(500).json([]); }
});

// 2. Liste des univers (Skins) créés dans le Studio
router.get('/skins', async (req, res) => {
    try {
        const skins = await mongoose.model('StudioProject').find({}, 'title scenes').lean();
        res.json(skins);
    } catch (e) { res.status(500).json([]); }
});

// @signatures: EleveGames, studioMirror, score
/**
 * 🎮 ROUTE MIROIR UNIFIÉE V108
 * Fix : Protection contre les crashs 500 (Check existence modèles)
 */
router.get('/studio-mirror', async (req, res) => {
    try {
        const StudioProject = mongoose.model('StudioProject');
        const GameLevel = mongoose.model('GameLevel');

        // On récupère en parallèle pour gagner du temps
        const [project, testQuiz] = await Promise.all([
            StudioProject.findOne({}).sort({ updatedAt: -1 }).lean(),
            GameLevel.findOne({ isTestGame: true }).sort({ updatedAt: -1 }).lean()
        ]);
        
        if (!project) return res.status(404).json({ error: "Aucun projet studio trouvé" });

        // FUSION TOTALE
        const fullMirror = {
            ...project,
            levels: testQuiz?.levels || [],
            globalIntro: testQuiz?.globalIntro || { sheetUrl: "", videoUrl: "" }
        };

        res.json(fullMirror);
    } catch (e) {
        console.error("❌ Erreur Mirror Backend:", e.message);
        res.status(500).json({ error: "Crash serveur miroir" });
    }
});

router.post('/score', async (req, res) => {
    try {
        const { studentId, gameId, score, levelReached } = req.body;
        const GameProgress = mongoose.model('GameProgress');
        await GameProgress.findOneAndUpdate(
            { studentId, gameId }, 
            { lastScore: score, levelReached: levelReached || 1, updatedAt: new Date() }, 
            { upsert: true }
        );
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
