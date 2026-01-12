const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const getCondaPath = async (teacherName, classroom) => {
    const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
    const teacherFolderId = await DriveService.getOrCreateFolder(teacherName, condaRootId);
    
    let classFolderName = classroom || "Sans_Classe";
    const classId = await DriveService.getOrCreateFolder(classFolderName, teacherFolderId);
    
    const worksId = await DriveService.getOrCreateFolder("1Travaux", classId);
    const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", classId);
    
    return { classId, worksId, prodId };
};

// --- ROUTES CHAPITRES ---

router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom } = req.body;
        const Chapter = mongoose.model('Chapter');
        const teacherName = "Jean Vuillet"; 

        if (_id) {
            const chap = await Chapter.findById(_id);
            if (!chap) return res.status(404).json({ error: "Chapitre non trouvé" });

            if (chap.driveFolderId && title && title !== chap.title) {
                await DriveService.renameFolder(chap.driveFolderId, title);
            }

            // Sécurité : on clone le body et on supprime l'_id pour éviter le crash Mongoose
            const updateData = { ...req.body };
            delete updateData._id;

            const updated = await Chapter.findByIdAndUpdate(_id, updateData, { new: true });
            return res.json(updated);
        }

        const { worksId } = await getCondaPath(teacherName, classroom);
        const driveId = await DriveService.getOrCreateFolder(title || "Nouveau Dossier", worksId);
        
        const newChap = await Chapter.create({ 
            ...req.body, 
            driveFolderId: driveId 
        });
        
        res.json(newChap);
    } catch (e) { 
        console.error("❌ Erreur /api/chapters:", e);
        res.status(500).json({ error: e.message }); 
    }
});

router.get('/chapters-all', async (req, res) => {
    try { 
        const list = await mongoose.model('Chapter').find({}).sort({ _id: -1 });
        res.json(list); 
    } catch (e) { 
        res.status(500).json([]); 
    }
});

router.delete('/chapters/:id', async (req, res) => {
    try {
        const chap = await mongoose.model('Chapter').findById(req.params.id);
        if (chap && chap.driveFolderId) {
            await DriveService.deleteFile(chap.driveFolderId);
        }
        await mongoose.model('Chapter').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

// --- SCAN SESSIONS (PRODUCTIONS) ---

router.get('/scan-sessions', async (req, res) => {
    try { 
        const sessions = await mongoose.model('ScanSession').find({}).sort({ createdAt: -1 });
        res.json(sessions); 
    } catch (e) { 
        res.status(500).json([]); 
    }
});

router.post('/scan-sessions', async (req, res) => {
    try {
        const { title, classroom } = req.body;
        const session = await mongoose.model('ScanSession').create({ title, classroom });
        res.json(session);
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

router.delete('/scan-sessions/:id', async (req, res) => {
    try { 
        await mongoose.model('ScanSession').findByIdAndDelete(req.params.id); 
        res.json({ ok: true }); 
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

router.patch('/scan-sessions/:id/rename', async (req, res) => {
    try {
        const session = await mongoose.model('ScanSession').findById(req.params.id);
        const datePart = session.title.includes('_') ? session.title.split('_').pop() : "";
        session.title = req.body.newPrefix + "_" + (datePart || new Date().toLocaleDateString());
        await session.save();
        res.json(session);
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

router.post('/scan-upload-photo', async (req, res) => {
    try {
        const { sessionId, type, imageBase64 } = req.body;
        const session = await mongoose.model('ScanSession').findById(sessionId);
        
        if (!session.driveFolderId) {
            const { prodId } = await getCondaPath("Jean Vuillet", session.classroom);
            session.driveFolderId = await DriveService.getOrCreateFolder(session.title || "Session", prodId);
            await session.save();
        }

        const fileName = type + "_" + Date.now() + ".jpg";
        const result = await DriveService.uploadImage(session.driveFolderId, fileName, imageBase64);
        
        if (result) {
            const field = type === 'quest' ? { $push: { questionUrls: result.id } } : { $push: { copyUrls: result.id } };
            const updated = await mongoose.model('ScanSession').findByIdAndUpdate(sessionId, field, { new: true });
            return res.json(updated);
        }
        throw new Error("Echec Drive");
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

router.post('/scan-delete-photo', async (req, res) => {
    try {
        const { sessionId, type, url } = req.body;
        await DriveService.deleteFile(url);
        const field = type === 'quest' ? { $pull: { questionUrls: url } } : { $pull: { copyUrls: url } };
        await mongoose.model('ScanSession').findByIdAndUpdate(sessionId, field);
        res.json({ ok: true });
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
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
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

router.get('/init-all-folders', async (req, res) => {
    try {
        await getCondaPath("Jean Vuillet", "2CD");
        await getCondaPath("Jean Vuillet", "6D");
        res.json({ ok: true });
    } catch(e) { 
        res.status(500).json({ error: e.message }); 
    }
});

module.exports = router;