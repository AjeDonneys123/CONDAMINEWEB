const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

/**
 * 🏗️ DOMAINE : STRUCTURE (Matières & Chapitres)
 * Rôle : Gérer l'arborescence logique (BDD) et physique (Drive)
 */

// US #1 : Récupérer tous les chapitres
router.get('/chapters', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        res.json(await Chapter.find({}));
    } catch (e) { res.status(500).json([]); }
});

// US #1 & #6 : Créer ou modifier un chapitre (et son miroir Drive)
router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject, teacherId } = req.body;
        const Teacher = mongoose.model('Teacher');
        const prof = await Teacher.findById(teacherId);
        if(!prof) return res.status(404).json({ error: "Prof introuvable" });

        const teacherName = `${prof.firstName} ${prof.lastName}`;
        // US #4 & #7 : Création physique forcée
        const { chapterId: driveId } = await DriveService.getMirrorPathId(teacherName, classroom, subject, title);

        let result;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            result = await mongoose.model('Chapter').findByIdAndUpdate(_id, { ...req.body, driveFolderId: driveId }, { new: true });
        } else {
            result = await mongoose.model('Chapter').create({ ...req.body, driveFolderId: driveId, isArchived: false });
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// US #9 : Suppression physique et logique d'un chapitre
router.delete('/chapters/:id', async (req, res) => {
    try {
        const Chapter = mongoose.model('Chapter');
        const chap = await Chapter.findById(req.params.id);
        if (chap?.driveFolderId) await DriveService.deleteEntity(chap.driveFolderId);
        await Chapter.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// US #8 & #9 : Le Grand Alignement (NUKE & SYNC)
router.post('/sync-drive', async (req, res) => {
    try {
        const { classroom, teacherId, mode } = req.body;
        if (!classroom) return res.status(400).json({ error: "Classe manquante" });

        const isReady = await DriveService.checkAuth();
        if (!isReady) return res.status(401).json({ error: "Drive déconnecté" });

        const prof = await mongoose.model('Teacher').findById(teacherId);
        const teacherName = `${prof.firstName} ${prof.lastName}`;
        const { classFolderId, devoirsFolderId } = await DriveService.getSpecificDevoirsFolder(teacherName, classroom);

        if (mode === 'nuke') {
            if (devoirsFolderId) await DriveService.deleteEntity(devoirsFolderId);
            await mongoose.model('Chapter').deleteMany({ classroom });
            await mongoose.model('Homework').deleteMany({ classroom });
            await DriveService.getOrCreateFolder("DEVOIRS", classFolderId);
            return res.json({ ok: true, message: "Nettoyage terminé." });
        }

        // Reconstruction conforme
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