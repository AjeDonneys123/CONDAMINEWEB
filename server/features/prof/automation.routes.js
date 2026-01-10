const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// Helper Date JJ-MM-26
const getSuffix = () => {
    const now = new Date();
    const jj = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${jj}-${mm}-26`;
};

// Helper Arborescence Racine
const getWorksFolder = async (classroom) => {
    const rootName = (classroom === '1D' || classroom === '1BFI') ? '1BFI' : classroom;
    const rootId = await DriveService.getOrCreateFolder(rootName);
    return await DriveService.getOrCreateFolder("1Travaux", rootId);
};

// --- 📂 GESTION DES DOSSIERS (CHAPTERS) ---

router.get('/chapters-all', async (req, res) => {
    try {
        const data = await mongoose.model('Chapter').find({});
        res.json(data);
    } catch (e) { res.status(500).json([]); }
});

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

router.delete('/chapters/:id', async (req, res) => {
    try {
        const chap = await mongoose.model('Chapter').findById(req.params.id);
        if (chap?.driveFolderId) await DriveService.deleteFile(chap.driveFolderId);
        await mongoose.model('Chapter').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- 📄 GESTION DES PRODUCTIONS (SCANS) ---

router.get('/scan-sessions', async (req, res) => {
    try {
        const data = await mongoose.model('ScanSession').find({}).sort({ createdAt: -1 });
        res.json(data);
    } catch(e) { res.status(500).json([]); }
});

router.post('/scan-sessions', async (req, res) => {
    try {
        const { classroom, title } = req.body;
        const dateStr = getSuffix();
        const finalTitle = title ? `${title.trim()}_${dateStr}` : dateStr;
        const rootName = (classroom === '1D' || classroom === '1BFI') ? '1BFI' : classroom;
        const rootId = await DriveService.getOrCreateFolder(rootName);
        const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", rootId);
        const hwId = await DriveService.getOrCreateFolder(finalTitle, prodId);
        const newSession = await mongoose.model('ScanSession').create({ title: finalTitle, classroom, driveFolderId: hwId });
        res.json(newSession);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/scan-sessions/:id/rename', async (req, res) => {
    try {
        const { newPrefix } = req.body;
        const session = await mongoose.model('ScanSession').findById(req.params.id);
        const parts = session.title.split('_');
        const suffix = parts[parts.length - 1];
        const newTitle = newPrefix ? `${newPrefix.trim()}_${suffix}` : suffix;
        if (session.driveFolderId) await DriveService.renameFolder(session.driveFolderId, newTitle);
        session.title = newTitle;
        await session.save();
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/scan-sessions/:id', async (req, res) => {
    try {
        const session = await mongoose.model('ScanSession').findById(req.params.id);
        if (session?.driveFolderId) await DriveService.deleteFile(session.driveFolderId);
        await mongoose.model('ScanSession').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false }); }
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

// --- 📸 GESTION DES PHOTOS ---

router.post('/scan-upload-photo', async (req, res) =>