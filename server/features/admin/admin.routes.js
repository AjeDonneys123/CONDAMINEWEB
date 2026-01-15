const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// US #15 : Fix Crash Players
router.get('/players', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        res.json(await Player.find({}).sort({ classroom: 1, lastName: 1 }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Route Chapters All (Fix 404)
router.get('/chapters-all', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        res.json(await Chapter.find({}));
    } catch (e) { res.status(500).json([]); }
});

// US #8 & #9 : NUKE & SYNC (LOGIQUE RADICALE)
router.post('/sync-drive', async (req, res) => {
    try {
        const { classroom, teacherId, mode } = req.body;
        const Teacher = mongoose.model('Teacher');
        const Chapter = mongoose.model('Chapter');
        const Homework = mongoose.model('Homework');

        const prof = await Teacher.findById(teacherId);
        if (!prof) throw new Error("Professeur non trouvé");
        const teacherName = `${prof.firstName} ${prof.lastName}`;

        // Localisation du dossier DEVOIRS
        const { classFolderId, devoirsFolderId } = await DriveService.getSpecificDevoirsFolder(teacherName, classroom);

        // --- MODE NUKE : ON SUPPRIME TOUT ---
        if (mode === 'nuke') {
            console.log(`🧨 NUKE EN COURS : ${classroom}`);
            if (devoirsFolderId) {
                await DriveService.deleteEntity(devoirsFolderId);
            }
            // Nettoyage BDD pour cette classe uniquement
            await Chapter.deleteMany({ classroom });
            await Homework.deleteMany({ classroom });
            
            // On recrée la base DEVOIRS propre
            await DriveService.getOrCreateFolder("DEVOIRS", classFolderId);
            
            return res.json({ ok: true, message: "Drive et BDD réinitialisés pour cette classe." });
        }

        // --- MODE SYNC : RECONSTRUCTION MIROIR ---
        const activeDevoirsId = await DriveService.getOrCreateFolder("DEVOIRS", classFolderId);
        const chapters = await Chapter.find({ classroom });
        const homeworks = await Homework.find({ classroom });

        for (const section of prof.subjectSections) {
            // Création dossier matière
            const subId = await DriveService.getOrCreateFolder(section.name, activeDevoirsId);
            
            const classChaps = chapters.filter(c => c.subject === section.name);
            for (const chap of classChaps) {
                const chapId = await DriveService.getOrCreateFolder(chap.title, subId);
                await Chapter.findByIdAndUpdate(chap._id, { driveFolderId: chapId });

                const hws = homeworks.filter(h => h.chapterId?.toString() === chap._id.toString());
                for (const hw of hws) {
                    const hwId = await DriveService.getOrCreateFolder(hw.title, chapId);
                    await DriveService.getOrCreateFolder("SUJET", hwId);
                    await DriveService.getOrCreateFolder("COPIES", hwId);
                    await DriveService.getOrCreateFolder("CORRECTIONS", hwId);
                    await Homework.findByIdAndUpdate(hw._id, { driveFolderId: hwId });
                }
            }
        }

        res.json({ ok: true, message: "Synchronisation miroir terminée." });
    } catch (e) {
        console.error("❌ Synchro Error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject, teacherId } = req.body;
        const prof = await mongoose.model('Teacher').findById(teacherId);
        const { classFolderId } = await DriveService.getSpecificDevoirsFolder(`${prof.firstName} ${prof.lastName}`, classroom);
        const devRoot = await DriveService.getOrCreateFolder("DEVOIRS", classFolderId);
        const subId = await DriveService.getOrCreateFolder(subject, devRoot);
        const driveId = await DriveService.getOrCreateFolder(title, subId);

        let result = _id ? await mongoose.model('Chapter').findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true })
                         : await mongoose.model('Chapter').create({ ...req.body, driveFolderId: driveId, isArchived: false });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/chapters/:id', async (req, res) => {
    try {
        const chap = await mongoose.model('Chapter').findById(req.params.id);
        if (chap?.driveFolderId) await DriveService.deleteEntity(chap.driveFolderId);
        await mongoose.model('Chapter').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;