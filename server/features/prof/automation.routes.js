const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// Helper Arborescence (CondaClasse / Prof / Classe / ...)
const getCondaPath = async (teacherName, classroom) => {
    const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
    const teacherId = await DriveService.getOrCreateFolder(teacherName, condaRootId);
    
    let classFolderName = classroom;
    if (classroom === '6D') classFolderName = '6e';
    if (classroom === '1D' || classroom === '1BFI') classFolderName = '1BFI';
    
    const classId = await DriveService.getOrCreateFolder(classFolderName, teacherId);
    const worksId = await DriveService.getOrCreateFolder("1Travaux", classId);
    const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", classId);
    return { classId, worksId, prodId };
};

// --- ROUTES CHAPITRES ---
router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, teacherId } = req.body;
        const Chapter = mongoose.model('Chapter');
        const Teacher = mongoose.model('Teacher');
        const teacher = await Teacher.findById(teacherId);
        const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : "Admin";

        if (_id) {
            const chap = await Chapter.findById(_id);
            if (chap.driveFolderId && title) await DriveService.renameFolder(chap.driveFolderId, title);
            const updated = await Chapter.findByIdAndUpdate(_id, req.body, { new: true });
            return res.json(updated);
        }

        const { worksId } = await getCondaPath(teacherName, classroom);
        const driveId = await DriveService.getOrCreateFolder(title || "Nouveau Dossier", worksId);
        const newChap = await Chapter.create({ ...req.body, driveFolderId: driveId });
        res.json(newChap);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/chapters/:id', async (req, res) => {
    try {
        const chap = await mongoose.model('Chapter').findById(req.params.id);
        if (chap && chap.driveFolderId) {
            await DriveService.deleteFile(chap.driveFolderId); // Supprime sur Drive
        }
        await mongoose.model('Chapter').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ROUTES SCAN SESSIONS (Celles qui manquaient probablement) ---

// 1. LISTER
router.get('/scan-sessions', async (req, res) => {
    try {
        const sessions = await mongoose.model('ScanSession').find({}).sort({ createdAt: -1 });
        res.json(sessions);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. CRÉER
router.post('/scan-sessions', async (req, res) => {
    try {
        const { title, classroom } = req.body;
        // Création BDD uniquement pour l'instant (le dossier Drive se crée si on upload)
        const session = await mongoose.model('ScanSession').create({ title, classroom });
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. RENOMMER
router.patch('/scan-sessions/:id/rename', async (req, res) => {
    try {
        const { newPrefix } = req.body;
        const session = await mongoose.model('ScanSession').findById(req.params.id);
        const datePart = session.title.includes('_') ? session.title.split('_').pop() : new Date().toLocaleDateString().replace(/\//g, '-');
        const newTitle = `${newPrefix}_${datePart}`;
        
        session.title = newTitle;
        await session.save();
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. SUPPRIMER
router.delete('/scan-sessions/:id', async (req, res) => {
    try {
        await mongoose.model('ScanSession').findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 5. UPLOAD PHOTO (Quest ou Copy)
router.post('/scan-upload-photo', async (req, res) => {
    try {
        const { sessionId, type, imageBase64 } = req.body;
        const session = await mongoose.model('ScanSession').findById(sessionId);
        
        // Si pas de dossier Drive, on le crée à la volée dans PRODUCTIONS
        if (!session.driveFolderId) {
            // On suppose un prof par défaut ou on le récupère du contexte (simplifié ici)
            const { prodId } = await getCondaPath("Jean Vuillet", session.classroom); 
            session.driveFolderId = await DriveService.getOrCreateFolder(session.title, prodId);
            await session.save();
        }

        const result = await DriveService.uploadImage(session.driveFolderId, `${type}_${Date.now()}.jpg`, imageBase64);
        if (result) {
            const field = type === 'quest' ? { $push: { questionUrls: result.id } } : { $push: { copyUrls: result.id } };
            const updated = await mongoose.model('ScanSession').findByIdAndUpdate(sessionId, field, { new: true });
            return res.json(updated);
        }
        res.status(500).json({ error: "Drive fail" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/scan-delete-photo', async (req, res) => {
    try {
        const { sessionId, type, url } = req.body;
        // Supprime de Drive (l'URL est l'ID Drive)
        await DriveService.deleteFile(url);
        
        const field = type === 'quest' ? { $pull: { questionUrls: url } } : { $pull: { copyUrls: url } };
        await mongoose.model('ScanSession').findByIdAndUpdate(sessionId, field);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 6. ASSIGNER À UN CHAPITRE
router.patch('/scan-sessions/:id/assign-chapter', async (req, res) => {
    try {
        const session = await mongoose.model('ScanSession').findById(req.params.id);
        const chapter = await mongoose.model('Chapter').findById(req.body.chapterId);
        
        // Déplacement Drive si les deux dossiers existent
        if (session.driveFolderId && chapter.driveFolderId) {
            await DriveService.moveFile(session.driveFolderId, chapter.driveFolderId);
        }
        
        session.chapterId = req.body.chapterId;
        await session.save();
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 7. INSTRUCTIONS PROFS
router.patch('/scan-sessions/:id/instructions', async (req, res) => {
    try {
        await mongoose.model('ScanSession').findByIdAndUpdate(req.params.id, { teacherInstruction: req.body.text });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;