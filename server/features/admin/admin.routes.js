const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// US #15 : Fix Crash Players (Anti-Erreur 500)
router.get('/players', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        const data = await Player.find({}).sort({ classroom: 1, lastName: 1 });
        res.json(data);
    } catch (e) { res.status(500).json({ error: "DATABASE_ERROR" }); }
});

router.get('/chapters-all', async (req, res) => {
    try { res.json(await mongoose.model('Chapter').find({})); } 
    catch (e) { res.status(500).json([]); }
});

// US #8 & #9 : SYNC ET NUKE (L'ARME ULTIME)
router.post('/sync-drive', async (req, res) => {
    try {
        const { classroom, teacherId, mode } = req.body;
        
        // Vérification Auth Drive
        const isReady = await DriveService.checkAuth();
        if (!isReady) return res.status(401).json({ error: "Drive déconnecté. Refaites le login Google." });

        const prof = await mongoose.model('Teacher').findById(teacherId);
        if (!prof) throw new Error("Professeur introuvable");
        const teacherName = `${prof.firstName} ${prof.lastName}`;

        // Localisation physique
        const { classFolderId, devoirsFolderId } = await DriveService.getDevoirsContext(teacherName, classroom);

        // --- MODE NUKE : ON RASE TOUT ---
        if (mode === 'nuke') {
            console.log(`🧨 NUKE : Nettoyage de ${classroom}`);
            
            // 1. On pulvérise le dossier DEVOIRS sur le Drive (supprime tous les enfants)
            if (devoirsFolderId) {
                await DriveService.deleteEntity(devoirsFolderId);
            }
            
            // 2. On vide les collections BDD pour cette classe
            await mongoose.model('Chapter').deleteMany({ classroom });
            await mongoose.model('Homework').deleteMany({ classroom });
            
            // 3. On recrée un dossier DEVOIRS tout neuf
            await DriveService.getOrCreateFolder("DEVOIRS", classFolderId);
            
            return res.json({ ok: true, message: `La classe ${classroom} a été totalement réinitialisée.` });
        }

        // --- MODE SYNC : RECONSTRUCTION MIROIR ---
        const cleanDevoirsId = await DriveService.getOrCreateFolder("DEVOIRS", classFolderId);
        const chapters = await mongoose.model('Chapter').find({ classroom });
        const homeworks = await mongoose.model('Homework').find({ classroom });

        for (const section of prof.subjectSections) {
            const subId = await DriveService.getOrCreateFolder(section.name, cleanDevoirsId);
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
        const { classFolderId } = await DriveService.getDevoirsContext(`${prof.firstName} ${prof.lastName}`, classroom);
        const devRoot = await DriveService.getOrCreateFolder("DEVOIRS", classFolderId);
        const subId = await DriveService.getOrCreateFolder(subject, devRoot);
        const driveId = await DriveService.getOrCreateFolder(title, subId);

        let result = _id ? await mongoose.model('Chapter').findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true })
                         : await mongoose.model('Chapter').create({ ...req.body, driveFolderId: driveId, isArchived: false });
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const { sections, className, deletedSection } = req.body;
        const prof = await mongoose.model('Teacher').findById(req.params.id);
        if (deletedSection && className) {
            const { devoirsFolderId } = await DriveService.getDevoirsContext(`${prof.firstName} ${prof.lastName}`, className);
            if (devoirsFolderId) {
                const res = await driveInstance.files.list({ q: `name = '${DriveService.normalize(deletedSection)}' and '${devoirsFolderId}' in parents` });
                if (res.data.files[0]) await DriveService.deleteEntity(res.data.files[0].id);
            }
        }
        const updated = await mongoose.model('Teacher').findByIdAndUpdate(req.params.id, { subjectSections: sections }, { new: true });
        res.json({ user: { id: updated._id, firstName: updated.firstName, lastName: updated.lastName, subjectSections: updated.subjectSections, role: 'prof' } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;