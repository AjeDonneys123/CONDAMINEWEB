const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// Route Players (Fix US #15)
router.get('/players', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        const data = await Player.find({}).sort({ classroom: 1, lastName: 1 });
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Route Chapters All (Fix 404)
router.get('/chapters-all', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const data = await Chapter.find({});
        res.json(data);
    } catch (e) { res.status(500).json([]); }
});

// US #8 & #9 : SYNC & NUKE (RECONSTRUCTION TOTALE)
router.post('/sync-drive', async (req, res) => {
    try {
        const { classroom, teacherId, mode } = req.body;
        const Teacher = mongoose.model('Teacher');
        const Chapter = mongoose.model('Chapter');
        const Homework = mongoose.model('Homework');

        const prof = await Teacher.findById(teacherId);
        if (!prof) throw new Error("Professeur introuvable");
        const teacherName = `${prof.firstName} ${prof.lastName}`;

        // Localiser le dossier de la CLASSE
        const classRootId = await DriveService.getDevoirsRootId(teacherName, classroom);
        
        // Trouver le dossier DEVOIRS actuel
        const children = await DriveService.listChildren(classRootId);
        const devoirsFolder = children.find(c => c.name === "DEVOIRS");

        // --- MODE NUKE : ON SUPPRIME LE DOSSIER DEVOIRS ENTIER ---
        if (mode === 'nuke') {
            console.log(`🧨 [NUKE] Suppression du dossier DEVOIRS pour ${classroom}`);
            if (devoirsFolder) await DriveService.deleteEntity(devoirsFolder.id);
            
            // Nettoyage BDD
            await Chapter.deleteMany({ classroom });
            await Homework.deleteMany({ classroom });
            
            // Recréer le dossier DEVOIRS tout neuf
            await DriveService.getOrCreateFolder("DEVOIRS", classRootId);
            
            return res.json({ ok: true, message: "Dossier DEVOIRS supprimé sur Drive et BDD vidée." });
        }

        // --- MODE SYNC : RECONSTRUCTION ---
        const devoirsId = await DriveService.getOrCreateFolder("DEVOIRS", classRootId);
        const chapters = await Chapter.find({ classroom });
        const homeworks = await Homework.find({ classroom });

        for (const section of prof.subjectSections) {
            const subFolderId = await DriveService.getOrCreateFolder(section.name, devoirsId);
            const secChapters = chapters.filter(c => c.subject === section.name);
            for (const chap of secChapters) {
                const chapFolderId = await DriveService.getOrCreateFolder(chap.title, subFolderId);
                await Chapter.findByIdAndUpdate(chap._id, { driveFolderId: chapFolderId });
                
                const hws = homeworks.filter(h => h.chapterId?.toString() === chap._id.toString());
                for (const hw of hws) {
                    const hwId = await DriveService.getOrCreateFolder(hw.title, chapFolderId);
                    await DriveService.getOrCreateFolder("SUJET", hwId);
                    await DriveService.getOrCreateFolder("COPIES", hwId);
                    await DriveService.getOrCreateFolder("CORRECTIONS", hwId);
                    await Homework.findByIdAndUpdate(hw._id, { driveFolderId: hwId });
                }
            }
        }

        res.json({ ok: true, message: "Drive réaligné sur les archives." });
    } catch (e) {
        console.error("❌ Erreur Sync:", e.message);
        res.status(500).json({ error: e.message });
    }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject, teacherId } = req.body;
        const prof = await mongoose.model('Teacher').findById(teacherId);
        const teacherName = `${prof.firstName} ${prof.lastName}`;
        
        const classRootId = await DriveService.getDevoirsRootId(teacherName, classroom);
        const devoirsId = await DriveService.getOrCreateFolder("DEVOIRS", classRootId);
        const subId = await DriveService.getOrCreateFolder(subject, devoirsId);
        const driveId = await DriveService.getOrCreateFolder(title, subId);

        let result;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            result = await mongoose.model('Chapter').findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true });
        } else {
            result = await mongoose.model('Chapter').create({ ...req.body, driveFolderId: driveId, isArchived: false });
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const { sections, className, deletedSection } = req.body;
        const prof = await mongoose.model('Teacher').findById(req.params.id);
        const teacherName = `${prof.firstName} ${prof.lastName}`;

        if (deletedSection && className) {
            const classRoot = await DriveService.getDevoirsRootId(teacherName, className);
            const devoirsId = await DriveService.getOrCreateFolder("DEVOIRS", classRoot);
            const children = await DriveService.listChildren(devoirsId);
            const target = children.find(c => c.name === DriveService.normalize(deletedSection));
            if (target) await DriveService.deleteEntity(target.id);
        }

        const updated = await mongoose.model('Teacher').findByIdAndUpdate(req.params.id, { subjectSections: sections }, { new: true });
        res.json({ user: { id: updated._id, firstName: updated.firstName, lastName: updated.lastName, subjectSections: updated.subjectSections, role: 'prof' } });
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