const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const normalize = (n) => DriveService.normalizeName(n);

// US #8 : Route de synchronisation globale
router.post('/sync-drive', async (req, res) => {
    try {
        const { classroom, teacherId } = req.body;
        const Teacher = mongoose.model('Teacher');
        const Chapter = mongoose.model('Chapter');
        const Homework = mongoose.model('Homework');

        const prof = await Teacher.findById(teacherId);
        const chapters = await Chapter.find({ classroom });
        const homeworks = await Homework.find({ classroom });

        const result = await DriveService.syncFullStructure(
            classroom, 
            prof.subjectSections, 
            chapters, 
            homeworks
        );

        if (result.error) throw new Error(result.error);
        res.json({ ok: true, message: "Drive synchronisé avec succès" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const { sections, className } = req.body;
        const Teacher = mongoose.model('Teacher');
        
        const updatedTeacher = await Teacher.findByIdAndUpdate(
            req.params.id, 
            { subjectSections: sections }, 
            { new: true }
        );

        if (className && sections.length > 0) {
            const hwRootId = await DriveService.getHomeworkRoot(className);
            const lastAdded = sections[sections.length - 1];
            await DriveService.getOrCreateFolder(lastAdded.name, hwRootId);
        }

        res.json({
            user: {
                id: updatedTeacher._id,
                firstName: updatedTeacher.firstName,
                lastName: updatedTeacher.lastName,
                subjectSections: updatedTeacher.subjectSections,
                role: 'prof'
            },
            message: "Matières synchronisées."
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/chapters', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const { _id, title, classroom, subject } = req.body;
        
        let driveId = req.body.driveFolderId;
        let fullPath = "CONDA CLASSE";

        if (title && subject && classroom) {
            const hwRootId = await DriveService.getHomeworkRoot(classroom);
            const subId = await DriveService.getOrCreateFolder(subject, hwRootId);
            driveId = await DriveService.getOrCreateFolder(title, subId);
            fullPath = `CONDA CLASSE / ${classroom.toUpperCase()} / DEVOIRS / ${normalize(subject)} / ${normalize(title)}`;
        }

        let result;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            result = await Chapter.findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true });
        } else {
            result = await Chapter.create({ ...req.body, driveFolderId: driveId, isArchived: false });
        }
        res.json({ ...result._doc, drivePath: fullPath });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/players', async (req, res) => {
    try { res.json(await mongoose.model('Player').find({}).sort({ classroom: 1, lastName: 1 })); } catch (e) { res.json([]); }
});

router.get('/chapters-all', async (req, res) => {
    try { res.json(await mongoose.model('Chapter').find({}).sort({ _id: -1 })); } catch (e) { res.json([]); }
});

router.delete('/chapters/:id', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const chap = await Chapter.findById(req.params.id);
        if (chap && chap.driveFolderId) {
            await DriveService.deleteFile(chap.driveFolderId);
        }
        await Chapter.findByIdAndDelete(req.params.id);
        res.json({ ok: true, message: "Dossier supprimé sur Drive" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;