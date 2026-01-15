const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

/**
 * 🏗️ DOMAINE : STRUCTURE (Hermétique)
 */

router.get('/chapters', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const data = await Chapter.find({});
        res.json(data);
    } catch (e) { res.status(500).json([]); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject, teacherId } = req.body;
        const Teacher = mongoose.model('Teacher');
        const prof = await Teacher.findById(teacherId);
        
        let driveId = req.body.driveFolderId || null;

        if (prof) {
            const teacherName = `${prof.firstName} ${prof.lastName}`;
            // Sécurité : on évite le crash si MirrorPath renvoie un objet vide
            const drivePaths = await DriveService.getMirrorPathId(teacherName, classroom, subject, title);
            if (drivePaths.chapterId) {
                driveId = drivePaths.chapterId;
            }
        }

        const Chapter = mongoose.model('Chapter');
        let result;
        
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            result = await Chapter.findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true });
        } else {
            result = await Chapter.create({ ...req.body, driveFolderId: driveId, isArchived: false });
        }
        
        res.json(result);
    } catch (e) {
        console.error("❌ Error Structure POST:", e.message);
        res.status(500).json({ error: e.message });
    }
});

router.delete('/chapters/:id', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const chap = await Chapter.findById(req.params.id);
        if (chap?.driveFolderId) await DriveService.deleteEntity(chap.driveFolderId);
        await Chapter.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// US #8 : Synchro Miroir
router.post('/sync-drive', async (req, res) => {
    try {
        const { classroom, teacherId, mode } = req.body;
        if (!classroom) return res.status(400).json({ error: "Classe non fournie" });

        const Teacher = mongoose.model('Teacher');
        const prof = await Teacher.findById(teacherId);
        if (!prof) return res.status(404).json({ error: "Prof introuvable" });
        const teacherName = `${prof.firstName} ${prof.lastName}`;

        const { classFolderId, devoirsFolderId } = await DriveService.getSpecificDevoirsFolder(teacherName, classroom);

        if (mode === 'nuke') {
            if (devoirsFolderId) await DriveService.deleteEntity(devoirsFolderId);
            await mongoose.model('Chapter').deleteMany({ classroom });
            await mongoose.model('Homework').deleteMany({ classroom });
            await DriveService.getOrCreateFolder("DEVOIRS", classFolderId);
            return res.json({ ok: true, message: "Nettoyage complet effectué." });
        }

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
        res.json({ ok: true, message: "Miroir Drive reconstruit." });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;