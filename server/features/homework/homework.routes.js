const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const DriveService = require('../../services/drive.service');

const upload = multer({ storage: multer.memoryStorage() });

const normalize = (n) => n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "_").trim();

// POST /api/homework/upload-to-drive (REPARÉ)
router.post('/upload-to-drive', upload.single('file'), async (req, res) => {
    try {
        const { classroom, title, type } = req.body;
        if(!req.file) throw new Error("Fichier manquant");

        const condaRootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
        const classId = await DriveService.getOrCreateFolder(normalize(classroom), condaRootId);
        const hwRootId = await DriveService.getOrCreateFolder("DEVOIRS_MANUELS", classId);
        const thisHwId = await DriveService.getOrCreateFolder(normalize(title || "DEVOIR_SANS_NOM"), hwRootId);
        const subjectFolderId = await DriveService.getOrCreateFolder("SUJET", thisHwId);

        const file = await DriveService.uploadFile(
            subjectFolderId, 
            `${type.toUpperCase()}_${Date.now()}.jpg`, 
            req.file.buffer, 
            req.file.mimetype
        );

        res.json({ ok: true, imageUrl: file.url, driveId: file.id });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// SAUVEGARDE + DISTRIBUTION (US #Distribution)
router.post('/', async (req, res) => {
    try {
        const Homework = mongoose.model('Homework');
        const Player = mongoose.model('Player');
        const { _id, targetPlayerIds, classroom, title, ...data } = req.body;
        
        let homework;
        if (_id) {
            homework = await Homework.findByIdAndUpdate(_id, { targetPlayerIds, classroom, title, ...data }, { new: true });
        } else {
            homework = await Homework.create({ targetPlayerIds, classroom, title, ...data });
        }

        // --- DISTRIBUTION AUTOMATIQUE SUR LE DRIVE ---
        if (targetPlayerIds && targetPlayerIds.length > 0) {
            const condaRootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
            const classId = await DriveService.getOrCreateFolder(normalize(classroom), condaRootId);
            const elevesRootId = await DriveService.getOrCreateFolder("ELEVES", classId);

            for (const pId of targetPlayerIds) {
                const student = await Player.findById(pId);
                if (student) {
                    const studentFolderId = await DriveService.getOrCreateFolder(normalize(student.lastName + "_" + student.firstName), elevesRootId);
                    const studentHwFolderId = await DriveService.getOrCreateFolder("DEVOIRS", studentFolderId);
                    
                    // On crée un raccourci vers le dossier du devoir
                    // targetId est l'ID BDD transformé en dossier Drive si possible ou le dossier central du devoir
                    // Pour simplifier : on pointe vers le dossier central du devoir
                    const hwRootId = await DriveService.getOrCreateFolder("DEVOIRS_MANUELS", classId);
                    const thisHwDriveId = await DriveService.getOrCreateFolder(normalize(title), hwRootId);
                    
                    await DriveService.createShortcut(thisHwDriveId, studentHwFolderId, title);
                }
            }
        }

        res.json(homework);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/all', async (req, res) => {
    try { res.json(await mongoose.model('Homework').find({}).sort({ date: -1 })); } catch (e) { res.status(500).json([]); }
});

module.exports = router;