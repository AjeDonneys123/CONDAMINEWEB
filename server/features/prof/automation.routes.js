const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// --- HELPER RACINE ---
const getCondaPath = async (classroom) => {
    const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
    const classId = await DriveService.getOrCreateFolder(classroom, condaRootId);
    const worksId = await DriveService.getOrCreateFolder("1Travaux", classId);
    const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", classId);
    return { condaRootId, classId, worksId, prodId };
};

// --- SYNCHRO TOTALE : CLASSES + DOSSIERS ÉLÈVES ---
router.get('/init-all-folders', async (req, res) => {
    try {
        const classes = ['6D', '5B', '5C', '2A', '2CD', '1BFI'];
        const Player = mongoose.model('Player');
        const Chapter = mongoose.model('Chapter');
        let report = [];

        for (const code of classes) {
            console.log(`🔨 Synchro Classe : ${code}`);
            const { classId, worksId } = await getCondaPath(code);

            // 1. Créer les dossiers pour chaque élève de cette classe
            const students = await Player.find({ classroom: code });
            console.log(`   👥 Création de ${students.length} dossiers élèves...`);
            
            for (const std of students) {
                const stdName = `${std.firstName} ${std.lastName}`;
                // On crée le dossier de l'élève DIRECTEMENT dans le dossier de sa classe
                await DriveService.getOrCreateFolder(stdName, classId);
            }

            // 2. Rattacher les chapitres d'activités dans 1Travaux
            const chaps = await Chapter.find({ classroom: code });
            for (const chap of chaps) {
                const newId = await DriveService.getOrCreateFolder(chap.title || "Dossier", worksId);
                chap.driveFolderId = newId;
                await chap.save();
            }
            report.push(`${code}: OK (${students.length} élèves)`);
        }
        res.json({ ok: true, report });
    } catch (e) {
        console.error("❌ Erreur Synchro:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// --- VOIR LES PRODUCTIONS DANS LE DOSSIER ÉLÈVE ---
router.get('/player-productions/:playerId', async (req, res) => {
    try {
        const player = await mongoose.model('Player').findById(req.params.playerId);
        if (!player) return res.status(404).json({ error: "Élève non trouvé" });

        const { classId } = await getCondaPath(player.classroom);
        const stdName = `${player.firstName} ${player.lastName}`;
        
        // On récupère l'ID du dossier de l'élève
        const stdFolderId = await DriveService.getOrCreateFolder(stdName, classId);
        const files = await DriveService.listFilesInFolder(stdFolderId);
        res.json(files);
    } catch (e) { res.status(500).json([]); }
});

// (Reste des routes creation, delete, scan-sessions, etc. inchangées)
router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, isArchived, subject, classroom } = req.body;
        const Chapter = mongoose.model('Chapter');
        if (_id) {
            const chap = await Chapter.findById(_id);
            if (chap.driveFolderId && title) await DriveService.renameFolder(chap.driveFolderId, title);
            return res.json(await Chapter.findByIdAndUpdate(_id, { title, isArchived }, { new: true }));
        }
        const { worksId } = await getCondaPath(classroom);
        const driveId = await DriveService.getOrCreateFolder(title || "Nouveau Dossier", worksId);
        res.json(await Chapter.create({ title: title || "Nouveau Dossier", subject, classroom, driveFolderId: driveId, isArchived: false }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/scan-sessions', async (req, res) => {
    try {
        const { classroom, title } = req.body;
        const dateStr = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-') + "-26";
        const finalTitle = title ? `${title.trim()}_${dateStr}` : dateStr;
        const { prodId } = await getCondaPath(classroom);
        const hwId = await DriveService.getOrCreateFolder(finalTitle, prodId);
        res.json(await mongoose.model('ScanSession').create({ title: finalTitle, classroom, driveFolderId: hwId }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/chapters/:id', async (req, res) => {
    const chap = await mongoose.model('Chapter').findById(req.params.id);
    if (chap?.driveFolderId) await DriveService.deleteFile(chap.driveFolderId);
    await mongoose.model('Chapter').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});

router.get('/chapters-all', async (req, res) => res.json(await mongoose.model('Chapter').find({})));
router.get('/scan-sessions', async (req, res) => res.json(await mongoose.model('ScanSession').find({}).sort({ createdAt: -1 })));

router.patch('/scan-sessions/:id/assign-chapter', async (req, res) => {
    const session = await mongoose.model('ScanSession').findById(req.params.id);
    const chapter = await mongoose.model('Chapter').findById(req.body.chapterId);
    if (session.driveFolderId && chapter.driveFolderId) await DriveService.moveFile(session.driveFolderId, chapter.driveFolderId);
    session.chapterId = req.body.chapterId; await session.save();
    res.json(session);
});

router.post('/scan-upload-photo', async (req, res) => {
    const { sessionId, type, imageBase64 } = req.body;
    const session = await mongoose.model('ScanSession').findById(sessionId);
    const result = await DriveService.uploadImage(session.driveFolderId, `${type}_${Date.now()}.jpg`, imageBase64);
    if (result) {
        const field = type === 'quest' ? { $push: { questionUrls: result.id } } : { $push: { copyUrls: result.id } };
        res.json(await mongoose.model('ScanSession').findByIdAndUpdate(sessionId, field, { new: true }));
    } else res.status(500).json({ error: "Drive fail" });
});

router.delete('/scan-sessions/:id', async (req, res) => {
    const session = await mongoose.model('ScanSession').findById(req.params.id);
    if (session?.driveFolderId) await DriveService.deleteFile(session.driveFolderId);
    await mongoose.model('ScanSession').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});

module.exports = router;