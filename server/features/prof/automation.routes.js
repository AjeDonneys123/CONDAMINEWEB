const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const getScanSession = () => mongoose.model('ScanSession');
const getChapter = () => mongoose.model('Chapter');
const getPlayer = () => mongoose.model('Player');
const getTeacher = () => mongoose.model('Teacher');

const normalizeFolderName = (name) => {
    return name.toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z0-9]/g, "_")
        .trim();
};

const getClassBasePaths = async (classroom) => {
    const condaRootId = await DriveService.getOrCreateFolder("CondaClasse", null);
    const teacherId = await DriveService.getOrCreateFolder("Jean Vuillet", condaRootId);
    const classId = await DriveService.getOrCreateFolder(classroom, teacherId);
    const devoirsId = await DriveService.getOrCreateFolder("Devoirs", classId);
    const elevesId = await DriveService.getOrCreateFolder("Élèves", classId);
    return { devoirsId, elevesId };
};

// --- ROUTE DE RÉORGANISATION ET NETTOYAGE STRICT (US #12) ---
router.get('/init-all-folders', async (req, res) => {
    try {
        console.log("🧼 Audit et Nettoyage du Drive lancé...");
        
        // 1. Récupérer le prof pour avoir la liste des "Vraies" matières (Sections)
        const teacher = await getTeacher().findOne({ firstName: "Jean" });
        if (!teacher) return res.status(404).json({ error: "Prof non trouvé" });
        
        const validSubjects = teacher.subjectSections.map(s => s.name);
        const validSubjectsNormalized = validSubjects.map(s => normalizeFolderName(s));

        const players = await getPlayer().find({});
        const classes = [...new Set(players.map(p => p.classroom))].filter(Boolean);

        for (const cls of classes) {
            console.log(`🔨 Audit Classe : ${cls}`);
            const paths = await getClassBasePaths(cls);

            // A. Recasage des chapitres
            const chapters = await getChapter().find({ classroom: cls });
            for (const chap of chapters) {
                const subjectName = chap.subject || "AUTRE";
                const subjectNormalized = normalizeFolderName(subjectName);
                const subjectFolderId = await DriveService.getOrCreateFolder(subjectNormalized, paths.devoirsId);
                
                const chapterFolderId = await DriveService.getOrCreateFolder(chap.title || "Sans Titre", subjectFolderId);
                await getChapter().findByIdAndUpdate(chap._id, { driveFolderId: chapterFolderId });
            }

            // B. Nettoyage des dossiers parasites sur Drive
            // On liste tous les dossiers présents dans "Devoirs" sur Drive
            const driveFolders = await DriveService.listFiles(paths.devoirsId);
            
            for (const folder of driveFolders) {
                if (folder.mimeType === 'application/vnd.google-apps.folder') {
                    // Si le dossier n'est pas dans la liste des matières validées
                    if (!validSubjectsNormalized.includes(normalizeFolderName(folder.name))) {
                        console.log(`🗑️ Parasite détecté : ${folder.name}. Vérification contenu...`);
                        
                        const subContent = await DriveService.listFiles(folder.id);
                        if (subContent.length === 0) {
                            console.log(`   -> Dossier vide, suppression.`);
                            await DriveService.deleteFile(folder.id);
                        } else {
                            console.log(`   -> Dossier non vide, conservé pour sécurité.`);
                        }
                    }
                }
            }

            // C. Vérifier les dossiers élèves
            for (const p of players.filter(p => p.classroom === cls)) {
                const studentName = `${p.firstName} ${p.lastName}`.toUpperCase();
                await DriveService.getOrCreateFolder(studentName, paths.elevesId);
            }
        }

        res.json({ ok: true, message: "Nettoyage terminé. Drive aligné sur les archives." });
    } catch (e) {
        console.error("❌ Erreur Audit Drive:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// --- ROUTES CHAPITRES ---
router.post('/chapters', async (req, res) => {
    try {
        const { _id, title, classroom, subject } = req.body;
        if (_id && mongoose.Types.ObjectId.isValid(_id)) {
            const updated = await getChapter().findByIdAndUpdate(_id, req.body, { new: true });
            return res.json(updated);
        }
        const paths = await getClassBasePaths(classroom);
        const subjectNormalized = normalizeFolderName(subject);
        const subjectFolderId = await DriveService.getOrCreateFolder(subjectNormalized, paths.devoirsId);
        const driveId = await DriveService.getOrCreateFolder(title, subjectFolderId);
        res.json(await getChapter().create({ ...req.body, driveFolderId: driveId, isArchived: false }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/scan-sessions', async (req, res) => {
    try {
        const data = await getScanSession().find({}).sort({ createdAt: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

router.post('/scan-sessions', async (req, res) => {
    try {
        const { title, classroom } = req.body;
        const session = await getScanSession().create({ title, classroom });
        const paths = await getClassBasePaths(classroom);
        const sessionDriveId = await DriveService.getOrCreateFolder(title, paths.devoirsId);
        const subjectId = await DriveService.getOrCreateFolder("Sujet", sessionDriveId);
        const copiesId = await DriveService.getOrCreateFolder("Copies", sessionDriveId);
        const final = await getScanSession().findByIdAndUpdate(session._id, {
            driveFolderId: sessionDriveId, subjectFolderId: subjectId, copiesFolderId: copiesId
        }, { new: true });
        res.json(final);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/scan-upload-photo', async (req, res) => {
    try {
        const { sessionId, type, imageBase64 } = req.body; 
        const session = await getScanSession().findById(sessionId);
        const targetFolder = type === 'subject' ? session.subjectFolderId : session.copiesFolderId;
        const driveFile = await DriveService.uploadImage(targetFolder, `${type}_${Date.now()}.jpg`, imageBase64);
        if (driveFile) {
            const field = type === 'subject' ? 'subjectUrls' : 'copyUrls';
            const updated = await getScanSession().findByIdAndUpdate(sessionId, { $push: { [field]: driveFile.id } }, { new: true });
            res.json(updated);
        } else { res.status(500).json({error: "Drive Fail"}); }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/scan-sessions/:id/assign-chapter', async (req, res) => {
    try {
        const updated = await getScanSession().findByIdAndUpdate(req.params.id, { chapterId: req.body.chapterId }, { new: true });
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/scan-sessions/:id', async (req, res) => {
    try {
        await getScanSession().findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;