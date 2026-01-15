const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// US #8 : Synchronisation Manuelle (Bouton 🔄)
router.post('/sync-drive', async (req, res) => {
    try {
        const { classroom, teacherId } = req.body;
        const Teacher = mongoose.model('Teacher');
        const Chapter = mongoose.model('Chapter');
        const Homework = mongoose.model('Homework');

        const prof = await Teacher.findById(teacherId);
        const classChapters = await Chapter.find({ classroom });
        const classHomeworks = await Homework.find({ classroom });

        console.log(`🔄 [SYNC] Début alignement pour ${classroom}`);
        
        const classRootId = await DriveService.getClassRoot(classroom);
        const devoirsId = await DriveService.getOrCreateFolder("DEVOIRS", classRootId);

        // Aligner chaque matière du prof
        for (const section of prof.subjectSections) {
            const secId = await DriveService.getOrCreateFolder(section.name, devoirsId);
            
            // Aligner les chapitres
            const chaps = classChapters.filter(c => c.subject === section.name);
            for (const chap of chaps) {
                const chapId = await DriveService.getOrCreateFolder(chap.title, secId);
                await Chapter.findByIdAndUpdate(chap._id, { driveFolderId: chapId });

                // Aligner les devoirs
                const hws = classHomeworks.filter(h => h.chapterId?.toString() === chap._id.toString());
                for (const hw of hws) {
                    const hwId = await DriveService.getOrCreateFolder(hw.title, chapId);
                    await DriveService.getOrCreateFolder("SUJET", hwId);
                    await DriveService.getOrCreateFolder("COPIES", hwId);
                    await DriveService.getOrCreateFolder("CORRECTIONS", hwId);
                    await Homework.findByIdAndUpdate(hw._id, { driveFolderId: hwId });
                }
            }
        }

        res.json({ ok: true, message: `Alignement Drive terminé pour ${classroom}` });
    } catch (e) {
        console.error("❌ Erreur Sync:", e.message);
        res.status(500).json({ error: e.message });
    }
});

router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const { sections, className } = req.body;
        const updatedTeacher = await mongoose.model('Teacher').findByIdAndUpdate(req.params.id, { subjectSections: sections }, { new: true });
        res.json({
            user: { id: updatedTeacher._id, firstName: updatedTeacher.firstName, lastName: updatedTeacher.lastName, subjectSections: updatedTeacher.subjectSections, role: 'prof' },
            message: "Matières mises à jour"
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject } = req.body;
        const classRootId = await DriveService.getClassRoot(classroom);
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

router.get('/players', async (req, res) => {
    try { res.json(await mongoose.model('Player').find({}).sort({ classroom: 1, lastName: 1 })); } catch (e) { res.json([]); }
});

router.get('/chapters-all', async (req, res) => {
    try { res.json(await mongoose.model('Chapter').find({}).sort({ _id: -1 })); } catch (e) { res.json([]); }
});

module.exports = router;