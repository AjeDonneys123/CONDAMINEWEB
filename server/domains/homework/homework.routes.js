const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const DriveEngine = require('../../core/drive.engine');
const StructureDrive = require('../structure/experts/structure.drive');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * 📝 ROUTES HOMEWORK V137 - MULTI-TARGET
 * Fix : Support de targetClassrooms pour la diffusion multiple.
 */

router.post('/', asyncHandler(async (req, res) => {
    const Homework = mongoose.model('Homework');
    const data = req.body;
    const vaultId = await StructureDrive.ensureVault();

    // Gestion des Uploads (inchangée)
    for (let level of data.levels) {
        const fields = ['instructionUrls', 'attachmentUrls'];
        for (let field of fields) {
            if (level[field]) {
                for (let i = 0; i < level[field].length; i++) {
                    const url = level[field][i];
                    if (url && url.startsWith('/uploads/')) {
                        const localPath = path.resolve(process.cwd(), 'public', url.substring(1));
                        if (fs.existsSync(localPath)) {
                            const fileName = path.basename(localPath);
                            const cloudFile = await DriveEngine.uploadFile(fileName, localPath, vaultId);
                            level[field][i] = `/api/structure/proxy/${cloudFile.id}`; 
                            try { fs.unlinkSync(localPath); } catch(e) {}
                        }
                    }
                }
            }
        }
    }

    // MISE À JOUR MULTI-CIBLES
    // On s'assure que targetClassrooms est bien rempli
    if (!data.targetClassrooms || data.targetClassrooms.length === 0) {
        // Fallback sur l'ancienne propriété si nécessaire
        if (data.classroom) data.targetClassrooms = [data.classroom];
    }

    let result;
    if (data._id) {
        result = await Homework.findByIdAndUpdate(data._id, data, { new: true });
    } else {
        result = await Homework.create(data);
    }

    res.json(result);
}));

router.get('/all', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('Homework').find({}).sort({ date: -1 }).lean());
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    await mongoose.model('Homework').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
}));

// Route Upload Temporaire
const multer = require('multer');
const upload = multer({ dest: 'public/uploads/' });
router.post('/upload', upload.array('files'), (req, res) => {
    const urls = req.files.map(f => `/uploads/${f.filename}`);
    res.json({ urls });
});

router.post('/analyze-homework', require('./experts/homework.db').processSubmission ? 
    (req, res) => require('./experts/homework.db').processSubmission(req.body, require('./experts/homework.ai')).then(r => res.json(r)) :
    (req, res) => res.json({ error: "Not implemented" })
);

module.exports = router;