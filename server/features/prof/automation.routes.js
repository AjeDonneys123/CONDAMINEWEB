const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// --- STRUCTURE CONDACLASSE ---
const getCondaPath = async (classroom) => {
    const condaRootId = await DriveService.getOrCreateFolder("CondaClasse");
    const classId = await DriveService.getOrCreateFolder(classroom, condaRootId);
    const worksId = await DriveService.getOrCreateFolder("1Travaux", classId);
    const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", classId);
    return { condaRootId, classId, worksId, prodId };
};

// --- MIGRATION CIBLÉE ---
router.get('/init-all-folders', async (req, res) => {
    try {
        const classes = ['6D', '5B', '5C', '2A', '2CD', '1BFI'];
        const Chapter = mongoose.model('Chapter');
        let report = [];

        for (const code of classes) {
            console.log(`🔍 [MIGRATION] Analyse pour la classe : ${code}`);
            const { worksId } = await getCondaPath(code);

            // 1. On cherche si un dossier "1Travaux" existe déjà ailleurs (ex: dans ton dossier "6e")
            // pour le déplacer vers le nouveau worksId si nécessaire.
            // Mais plus simple : on déplace les CHAPITRES (dossiers enfants) vers le nouveau worksId.
            
            const chaps = await Chapter.find({ classroom: code });
            for (const chap of chaps) {
                if (chap.driveFolderId) {
                    console.log(`   🚚 Déplacement physique du chapitre : ${chap.title}`);
                    await DriveService.moveFile(chap.driveFolderId, worksId);
                } else {
                    const newId = await DriveService.getOrCreateFolder(chap.title || "Dossier sans titre", worksId);
                    chap.driveFolderId = newId;
                    await chap.save();
                }
            }
            report.push(`${code}: OK`);
        }
        res.json({ message: "Migration vers CondaClasse terminée", report });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- CRÉATION CHAPITRE (Direct dans CondaClasse) ---
router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, isArchived, subject, classroom } = req.body;
        const Chapter = mongoose.model('Chapter');
        
        if (_id) {
            const chap = await Chapter.findById(_id);
            if (chap.driveFolderId && title && title !== chap.title) {
                await DriveService.renameFolder(chap.driveFolderId, title);
            }
            return res.json(await Chapter.findByIdAndUpdate(_id, { title, isArchived }, { new: true }));
        }

        const { worksId } = await getCondaPath(classroom);
        const folderTitle = title || "Nouveau Dossier";
        const driveId = await DriveService.getOrCreateFolder(folderTitle, worksId);

        res.json(await Chapter.create({ 
            title: folderTitle, subject, classroom, driveFolderId: driveId, isArchived: false 
        }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- CRÉATION PRODUCTION (Direct dans CondaClasse/PRODUCTIONS) ---
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

// (Reste des routes : delete, rename, upload, instructions, player-productions inchangées)
router.get('/chapters-all', async (req, res) => res.json(await mongoose.model('Chapter').find({})));
router.delete('/chapters/:id', async (req, res) => {
    const chap = await mongoose.model('Chapter').findById(req.params.id);
    if (chap?.driveFolderId) await DriveService.deleteFile(chap.driveFolderId);
    await mongoose.model('Chapter').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});
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
router.post('/scan-delete-photo', async (req, res) => {
    const { sessionId, type, url } = req.body;
    const idMatch = url.match(/id=([-\w]{25,})/) || url.match(/\/d\/([-\w]{25,})/);
    if (idMatch) await DriveService.deleteFile(idMatch[1]);
    const field = type === 'quest' ? { questionUrls: url } : { copyUrls: url };
    res.json(await mongoose.model('ScanSession').findByIdAndUpdate(sessionId, { $pull: field }, { new: true }));
});
router.patch('/scan-sessions/:id/instructions', async (req, res) => {
    await mongoose.model('ScanSession').findByIdAndUpdate(req.params.id, { teacherInstruction: req.body.text });
    res.json({ ok: true });
});
router.get('/player-productions/:playerId', async (req, res) => {
    const player = await mongoose.model('Player').findById(req.params.playerId);
    const { prodId } = await getCondaPath(player.classroom);
    const stdId = await DriveService.getOrCreateFolder(`${player.firstName} ${player.lastName}`, prodId);
    res.json(await DriveService.listFilesInFolder(stdId));
});

module.exports = router;