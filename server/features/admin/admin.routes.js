const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// US #8 & #9 : RECONSTRUCTION MIROIR (TABULA RASA)
router.post('/sync-drive', async (req, res) => {
    try {
        const { classroom, teacherId, mode } = req.body;
        
        // Vérification de sécurité avant de lancer
        const isReady = await DriveService.checkAuth();
        if (!isReady) return res.status(401).json({ error: "Drive déconnecté. Vérifiez votre .env" });

        const prof = await mongoose.model('Teacher').findById(teacherId);
        if (!prof) throw new Error("Professeur non trouvé");
        const teacherName = `${prof.firstName} ${prof.lastName}`;

        const { classFolderId, devoirsFolderId } = await DriveService.getSpecificDevoirsFolder(teacherName, classroom);

        // --- MODE NUKE : SUPPRESSION ET RÉINITIALISATION ---
        if (mode === 'nuke') {
            if (devoirsFolderId) await DriveService.deleteEntity(devoirsFolderId);
            await mongoose.model('Chapter').deleteMany({ classroom });
            await mongoose.model('Homework').deleteMany({ classroom });
            // On recrée la structure DEVOIRS toute propre
            await DriveService.getOrCreateFolder("DEVOIRS", classFolderId);
            return res.json({ ok: true, message: "Nettoyage terminé. Drive et BDD sont conformes (vides)." });
        }

        // --- MODE SYNC : RECONSTRUCTION SELON ARCHIVES ---
        const chapters = await mongoose.model('Chapter').find({ classroom });
        const homeworks = await mongoose.model('Homework').find({ classroom });

        for (const section of prof.subjectSections) {
            const subId = await DriveService.getOrCreateFolder(section.name, devoirsFolderId);
            const classChaps = chapters.filter(c => c.subject === section.name);
            
            for (const chap of classChaps) {
                const chapId = await DriveService.getOrCreateFolder(chap.title, subId);
                await mongoose.model('Chapter').findByIdAndUpdate(chap._id, { driveFolderId: chapId });

                const hws = homeworks.filter(h => h.chapterId?.toString() === chap._id.toString());
                for (const hw of hws) {
                    const hwId = await DriveService.getOrCreateFolder(hw.title, chapId);
                    await DriveService.getOrCreateFolder("SUJET", hwId);
                    await DriveService.getOrCreateFolder("COPIES", hwId);
                    await DriveService.getOrCreateFolder("CORRECTIONS", hwId);
                    await mongoose.model('Homework').findByIdAndUpdate(hw._id, { driveFolderId: hwId });
                }
            }
        }
        res.json({ ok: true, message: "Synchronisation miroir effectuée avec succès." });
    } catch (e) {
        console.error("❌ Sync Error:", e.message);
        res.status(500).json({ error: e.message });
    }
});

router.get('/players', async (req, res) => {
    try { res.json(await mongoose.model('Player').find({}).sort({ classroom: 1, lastName: 1 })); } 
    catch (e) { res.status(500).json({ error: "DB_ERROR" }); }
});

router.get('/chapters-all', async (req, res) => {
    try { res.json(await mongoose.model('Chapter').find({})); } 
    catch (e) { res.status(500).json([]); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject, teacherId } = req.body;
        const prof = await mongoose.model('Teacher').findById(teacherId);
        const { devoirsFolderId } = await DriveService.getSpecificDevoirsFolder(`${prof.firstName} ${prof.lastName}`, classroom);
        const subId = await DriveService.getOrCreateFolder(subject, devoirsFolderId);
        const driveId = await DriveService.getOrCreateFolder(title, subId);

        let result = _id ? await mongoose.model('Chapter').findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true })
                         : await mongoose.model('Chapter').create({ ...req.body, driveFolderId: driveId, isArchived: false });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;