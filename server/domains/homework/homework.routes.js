// @signatures: DELETE /:id, GET /all, GET /submission/:id, GET /submissions, POST /, POST /analyze-homework, POST /generate-hints, POST /remove-punishment, POST /upload, PUT /submission/:id
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const HomeworkDB = require('./experts/homework.db');
const HomeworkAI = require('./experts/homework.ai');
const DriveEngine = require('../../core/drive.engine'); // V2: Import DriveEngine

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Config Multer (Stockage temporaire avant envoi Drive)
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

// --- NOUVELLE ROUTE : ANNULER UNE PUNITION ---
router.post('/remove-punishment', asyncHandler(async (req, res) => {
    const { homeworkId, studentId } = req.body;
    
    // 1. Retirer l'élève du devoir Punition
    await mongoose.model('Homework').findByIdAndUpdate(homeworkId, {
        $pull: { assignedStudents: studentId }
    });

    // 2. Remettre le statut de l'élève à la normale
    await mongoose.model('Student').findByIdAndUpdate(studentId, {
        punishmentStatus: 'NONE',
        punishmentDueDate: null
    });

    res.json({ ok: true, message: "Punition annulée." });
}));

// --- ROUTE : GÉNÉRER GRILLE DE CORRECTION ---
router.post('/generate-hints', asyncHandler(async (req, res) => {
    const { instruction, assets } = req.body;
    if (!assets || assets.length === 0) return res.status(400).json({ error: "Aucun document chargé." });
    const hints = await HomeworkAI.generateHintsFromAssets(instruction, assets);
    res.json({ hints });
}));

router.post('/', asyncHandler(async (req, res) => {
    const Homework = mongoose.model('Homework');
    const data = req.body;
    let result;
    if (data._id) result = await Homework.findByIdAndUpdate(data._id, data, { new: true });
    else result = await Homework.create(data);
    res.json(result);
}));

router.get('/all', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('Homework').find({}).sort({ date: -1 }).lean());
}));

router.get('/submissions', asyncHandler(async (req, res) => {
    const subs = await mongoose.model('Submission').find({}, 'studentId homeworkId grade createdAt').lean();
    res.json(subs);
}));

router.get('/submission/:id', asyncHandler(async (req, res) => {
    const sub = await HomeworkDB.getSubmissionDetails(req.params.id);
    if (!sub) return res.status(404).json({ error: "Copie introuvable" });
    res.json(sub);
}));

router.put('/submission/:id', asyncHandler(async (req, res) => {
    const updated = await HomeworkDB.updateSubmission(req.params.id, req.body);
    res.json(updated);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    await mongoose.model('Homework').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
}));

// V2: UPLOAD DRIVE CONNECTED
router.post('/upload', upload.array('files'), asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: "Fichier manquant" });
    
    const urls = [];
    try {
        // Dossier spécifique pour les assets de devoirs
        const homeworksFolderId = await DriveEngine.getOrCreateFolder("CONDA_HOMEWORK_ASSETS");
        
        for (const file of req.files) {
            // Upload vers Drive
            const driveFile = await DriveEngine.uploadFile(file.originalname, file.path, homeworksFolderId);
            
            // On génère l'URL Proxy pour l'affichage frontend
            const proxyUrl = `/api/structure/proxy/${driveFile.id}`;
            urls.push(proxyUrl);
            
            // Nettoyage immédiat du fichier local
            try { fs.unlinkSync(file.path); } catch(e) { console.error("Cleanup error:", e); }
        }
        res.json({ urls });
    } catch (e) {
        console.error("Drive Upload Error:", e);
        res.status(500).json({ error: "Erreur lors de l'envoi vers le Drive." });
    }
}));

router.post('/analyze-homework', (req, res) => HomeworkDB.processSubmission(req.body, HomeworkAI).then(r => res.json(r)));

module.exports = router;
