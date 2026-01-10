const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// --- HELPER MAPPING (6D -> 6e) ---
const getWorksFolder = async (classroom) => {
    let rootName = classroom;
    // On s'aligne sur tes dossiers manuels
    if (classroom === '6D') rootName = '6e';
    if (classroom === '1D' || classroom === '1BFI') rootName = '1BFI';
    
    console.log(`📂 [DRIVE] Recherche racine pour ${classroom} sous le nom : ${rootName}`);
    const rootId = await DriveService.getOrCreateFolder(rootName);
    if (!rootId) throw new Error(`Dossier racine ${rootName} introuvable`);

    // On crée ou récupère "1Travaux" à l'intérieur
    return await DriveService.getOrCreateFolder("1Travaux", rootId);
};

// --- INITIALISATION COMPLÈTE (Bouton Synchro) ---
router.get('/init-all-folders', async (req, res) => {
    try {
        const classes = ['6D', '5B', '5C', '2A', '2CD', '1D'];
        for (const c of classes) {
            await getWorksFolder(c);
        }
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- CRÉATION DE CHAPITRE (SYNC 1TRAVAUX) ---
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
        const driveId = await DriveService.getOrCreateFolder(title || "Nouveau Dossier", worksId);

        const newChap = await Chapter.create({ 
            title: title || "Nouveau Dossier", 
            subject, 
            classroom, 
            driveFolderId: driveId,
            isArchived: false 
        });
        res.json(newChap);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- RESTE DES ROUTES (Scans, Upload, Deletion) ---
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
        if (session.driveFolderId && chapter.driveFolderId) {
            await DriveService.moveFile(session.driveFolderId, chapter.driveFolderId);
        }
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
        const jj = String(new Date().getDate()).padStart(2, '0');
        const mm = String(new Date().getMonth() + 1).padStart(2, '0');
        const dateStr = `${jj}-${mm}-26`;
        const finalTitle = title ? `${title.trim()}_${dateStr}` : dateStr;
        const root = (classroom === '6D') ? '6e' : ((classroom === '1D') ? '1BFI' : classroom);
        const rootId = await DriveService.getOrCreateFolder(root);
        const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", rootId);
        const hwId = await DriveService.getOrCreateFolder(finalTitle, prodId);
        const newSession = await mongoose.model('ScanSession').create({ title: finalTitle, classroom, driveFolderId: hwId });
        res.json(newSession);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/scan-sessions/:id', async (req, res) => {
    const session = await mongoose.model('ScanSession').findById(req.params.id);
    if (session?.driveFolderId) await DriveService.deleteFile(session.driveFolderId).catch(() => {});
    await mongoose.model('ScanSession').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});

module.exports = router;