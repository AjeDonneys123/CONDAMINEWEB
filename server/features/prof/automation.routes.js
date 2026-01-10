const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// Helper Arborescence (Mapping 6D -> 6e inclus)
const getWorksFolder = async (classroom) => {
    let rootName = classroom;
    if (classroom === '6D') rootName = '6e';
    if (classroom === '1D' || classroom === '1BFI') rootName = '1BFI';
    
    const rootId = await DriveService.getOrCreateFolder(rootName);
    return await DriveService.getOrCreateFolder("1Travaux", rootId);
};

// --- ROUTE DE MIGRATION ET SYNCHRO TOTALE ---
router.get('/init-all-folders', async (req, res) => {
    try {
        const classes = ['6D', '5B', '5C', '2A', '2CD', '1D'];
        const Chapter = mongoose.model('Chapter');
        let movedCount = 0;

        for (const classroom of classes) {
            console.log(`📦 Migration de la classe : ${classroom}...`);
            const worksId = await getWorksFolder(classroom);

            // Trouver tous les chapitres de cette classe en BDD
            const chaps = await Chapter.find({ classroom: classroom });

            for (const chap of chaps) {
                if (chap.driveFolderId) {
                    console.log(`   🚀 Déplacement de : ${chap.title}`);
                    // On déplace physiquement le dossier vers 1Travaux
                    await DriveService.moveFile(chap.driveFolderId, worksId);
                    movedCount++;
                } else {
                    // Si le chapitre n'avait pas de dossier, on le crée
                    console.log(`   🆕 Création dossier manquant pour : ${chap.title}`);
                    const newId = await DriveService.getOrCreateFolder(chap.title, worksId);
                    chap.driveFolderId = newId;
                    await chap.save();
                }
            }
        }

        res.json({ ok: true, message: `${movedCount} chapitres ont été rangés dans 1Travaux.` });
    } catch (e) {
        console.error("❌ Erreur Migration:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// --- CRÉATION DE CHAPITRE (SYNC DIRECTE) ---
router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, isArchived, subject, classroom } = req.body;
        const Chapter = mongoose.model('Chapter');
        
        if (_id) {
            const chap = await Chapter.findById(_id);
            if (chap.driveFolderId && title && title !== chap.title) {
                await DriveService.renameFolder(chap.driveFolderId, title);
            }
            const updated = await Chapter.findByIdAndUpdate(_id, { title, isArchived }, { new: true });
            return res.json(updated);
        }

        const worksId = await getWorksFolder(classroom);
        const folderTitle = title || "Nouveau Dossier";
        const driveId = await DriveService.getOrCreateFolder(folderTitle, worksId);

        const newChap = await Chapter.create({ 
            title: folderTitle, subject, classroom, driveFolderId: driveId, isArchived: false 
        });
        res.json(newChap);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// (Reste des routes : list-chaps, scan-sessions, upload, rename, assign, etc. inchangées)
router.get('/chapters-all', async (req, res) => {
    try { res.json(await mongoose.model('Chapter').find({})); } catch (e) { res.status(500).json([]); }
});
router.delete('/chapters/:id', async (req, res) => {
    try {
        const chap = await mongoose.model('Chapter').findById(req.params.id);
        if (chap?.driveFolderId) await DriveService.deleteFile(chap.driveFolderId);
        await mongoose.model('Chapter').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/scan-sessions', async (req, res) => {
    res.json(await mongoose.model('ScanSession').find({}).sort({ createdAt: -1 }));
});
router.patch('/scan-sessions/:id/assign-chapter', async (req, res) => {
    try {
        const session = await mongoose.model('ScanSession').findById(req.params.id);
        const chapter = await mongoose.model('Chapter').findById(req.body.chapterId);
        if (session.driveFolderId && chapter.driveFolderId) await DriveService.moveFile(session.driveFolderId, chapter.driveFolderId);
        session.chapterId = req.body.chapterId;
        await session.save();
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/scan-upload-photo', async (req, res) => {
    try {
        const { sessionId, type, imageBase64 } = req.body;
        const session = await mongoose.model('ScanSession').findById(sessionId);
        const result = await DriveService.uploadImage(session.driveFolderId, `${type}_${Date.now()}.jpg`, imageBase64);
        if (result && result.id) {
            const field = type === 'quest' ? { $push: { questionUrls: result.id } } : { $push: { copyUrls: result.id } };
            const updated = await mongoose.model('ScanSession').findByIdAndUpdate(sessionId, field, { new: true });
            return res.json(updated);
        }
        res.status(500).json({ error: "Echec Drive" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/scan-sessions', async (req, res) => {
    try {
        const { classroom, title } = req.body;
        const now = new Date();
        const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-26`;
        const finalTitle = title ? `${title.trim()}_${dateStr}` : dateStr;
        const rootName = (classroom === '6D') ? '6e' : ((classroom === '1D' || classroom === '1BFI') ? '1BFI' : classroom);
        const rootId = await DriveService.getOrCreateFolder(rootName);
        const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", rootId);
        const hwId = await DriveService.getOrCreateFolder(finalTitle, prodId);
        res.json(await mongoose.model('ScanSession').create({ title: finalTitle, classroom, driveFolderId: hwId }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/scan-sessions/:id', async (req, res) => {
    const session = await mongoose.model('ScanSession').findById(req.params.id);
    if (session?.driveFolderId) await DriveService.deleteFile(session.driveFolderId).catch(() => {});
    await mongoose.model('ScanSession').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});
router.patch('/scan-sessions/:id/rename', async (req, res) => {
    const { newPrefix } = req.body;
    const session = await mongoose.model('ScanSession').findById(req.params.id);
    const suffix = session.title.split('_').pop();
    const newTitle = newPrefix ? `${newPrefix}_${suffix}` : suffix;
    if (session.driveFolderId) await DriveService.renameFolder(session.driveFolderId, newTitle);
    session.title = newTitle; await session.save();
    res.json(session);
});
router.post('/scan-delete-photo', async (req, res) => {
    try {
        const { sessionId, type, url } = req.body;
        const idMatch = url.match(/id=([-\w]{25,})/) || url.match(/\/d\/([-\w]{25,})/);
        if (idMatch) await DriveService.deleteFile(idMatch[1]);
        const field = type === 'quest' ? { questionUrls: url } : { copyUrls: url };
        const updated = await mongoose.model('ScanSession').findByIdAndUpdate(sessionId, { $pull: field }, { new: true });
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
router.patch('/scan-sessions/:id/instructions', async (req, res) => {
    await mongoose.model('ScanSession').findByIdAndUpdate(req.params.id, { teacherInstruction: req.body.text });
    res.json({ ok: true });
});

module.exports = router;