const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// US #15 : Fix Error 500 sur Players
router.get('/players', async (req, res) => {
    try {
        const Player = mongoose.model('Player');
        const data = await Player.find({}).sort({ classroom: 1, lastName: 1 });
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// US #8 : LOGIQUE NUKE & REBUILD (CONFORMITÉ ABSOLUE)
router.post('/sync-drive', async (req, res) => {
    try {
        const { classroom, teacherId } = req.body;
        const Teacher = mongoose.model('Teacher');
        const Chapter = mongoose.model('Chapter');
        const Homework = mongoose.model('Homework');

        const prof = await Teacher.findById(teacherId);
        if (!prof) throw new Error("Prof non trouvé");
        const teacherName = `${prof.firstName} ${prof.lastName}`;

        console.log(`🚀 [SYNC] Reconstruction miroir pour ${teacherName} / ${classroom}`);

        // 1. Localiser la racine DEVOIRS
        const rootId = await DriveService.getOrCreateFolder("CONDA CLASSE");
        const profId = await DriveService.getOrCreateFolder(teacherName, rootId);
        const classId = await DriveService.getOrCreateFolder(classroom, profId);
        const devoirsId = await DriveService.getOrCreateFolder("DEVOIRS", classId);

        // 2. CRÉER DOSSIER "AUTRE" ET VIDER DEVOIRS (TRANSFERT)
        const backupId = await DriveService.getOrCreateFolder(`SAUVEGARDE_${Date.now()}`, classId);
        const existingFiles = await google.drive({version:'v3', auth: drive.auth}).files.list({
            q: `'${devoirsId}' in parents and trashed = false`,
            fields: 'files(id, name)'
        });

        for (const file of (existingFiles.data.files || [])) {
            await DriveService.moveEntity(file.id, backupId);
        }

        // 3. RECONSTITUER TOUTE LA STRUCTURE DEPUIS BDD
        const classChapters = await Chapter.find({ classroom });
        const classHomeworks = await Homework.find({ classroom });

        for (const section of prof.subjectSections) {
            const subjectId = await DriveService.getOrCreateFolder(section.name, devoirsId);
            const chaps = classChapters.filter(c => c.subject === section.name);
            
            for (const chap of chaps) {
                const chapId = await DriveService.getOrCreateFolder(chap.title, subjectId);
                await Chapter.findByIdAndUpdate(chap._id, { driveFolderId: chapId });

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

        res.json({ ok: true, message: "Drive réinitialisé et synchronisé conformément aux archives." });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: e.message }); 
    }
});

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject, teacherId } = req.body;
        const prof = await mongoose.model('Teacher').findById(teacherId);
        const teacherName = `${prof.firstName} ${prof.lastName}`;

        const rootId = await DriveService.getOrCreateFolder("CONDA CLASSE");
        const profId = await DriveService.getOrCreateFolder(teacherName, rootId);
        const classId = await DriveService.getOrCreateFolder(classroom, profId);
        const devRoot = await DriveService.getOrCreateFolder("DEVOIRS", classId);
        const subId = await DriveService.getOrCreateFolder(subject, devRoot);
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

router.get('/chapters-all', async (req, res) => {
    try { res.json(await mongoose.model('Chapter').find({})); } catch (e) { res.json([]); }
});

module.exports = router;