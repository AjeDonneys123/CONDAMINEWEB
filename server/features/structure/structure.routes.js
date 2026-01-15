const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// US #1 : Récupérer tous les chapitres
router.get('/chapters', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        res.json(await Chapter.find({}));
    } catch (e) { res.status(500).json([]); }
});

// US #1 & #4 : Création conforme de Chapitre
router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject, teacherId } = req.body;
        const prof = await mongoose.model('Teacher').findById(teacherId);
        
        let driveId = req.body.driveFolderId || null;

        if (prof) {
            const teacherName = `${prof.firstName} ${prof.lastName}`;
            const pathInfo = await DriveService.getMirrorPathId(teacherName, classroom, subject, title);
            if (pathInfo.chapterId) driveId = pathInfo.chapterId;
        }

        const Chapter = mongoose.model('Chapter');
        let result;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            result = await Chapter.findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true });
        } else {
            result = await Chapter.create({ ...req.body, driveFolderId: driveId, isArchived: false });
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// US #8 : SYNC & NUKE (REBUILD COMPLET)
router.post('/sync-drive', async (req, res) => {
    try {
        const { classroom, teacherId, mode } = req.body;
        const prof = await mongoose.model('Teacher').findById(teacherId);
        if (!prof) return res.status(404).json({ error: "Prof introuvable" });
        
        const teacherName = `${prof.firstName} ${prof.lastName}`;
        const pathInfo = await DriveService.getMirrorPathId(teacherName, classroom, "INIT");
        const devId = pathInfo.devoirsId;

        if (mode === 'nuke') {
            if (devId) await DriveService.deleteEntity(devId);
            await mongoose.model('Chapter').deleteMany({ classroom });
            await mongoose.model('Homework').deleteMany({ classroom });
            // Recrée immédiatement le dossier devoirs
            await DriveService.getMirrorPathId(teacherName, classroom, "INIT");
            return res.json({ ok: true, message: "Tabula Rasa effectuée avec succès." });
        }

        // Reconstruction Miroir (BDD -> Drive)
        const chapters = await mongoose.model('Chapter').find({ classroom });
        const homeworks = await mongoose.model('Homework').find({ classroom });

        for (const section of prof.subjectSections) {
            const sectionPath = await DriveService.getMirrorPathId(teacherName, classroom, section.name);
            const chaps = chapters.filter(c => c.subject === section.name);
            
            for (const chap of chaps) {
                const chapId = await DriveService.getOrCreateFolder(chap.title, sectionPath.subjectId);
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
        res.json({ ok: true, message: "Alignement Drive terminé." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;