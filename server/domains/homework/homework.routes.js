const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const DriveEngine = require('../../core/drive.engine');
const StructureDrive = require('../structure/experts/structure.drive');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * 📝 ROUTES HOMEWORK V102 - GÉNÉRATION D'URLS PROXY
 */

router.post('/', asyncHandler(async (req, res) => {
    const Homework = mongoose.model('Homework');
    const data = req.body;
    const vaultId = await StructureDrive.ensureVault();

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
                            // V102 : On récupère l'ID réel du fichier sur le cloud
                            const cloudFile = await DriveEngine.uploadFile(fileName, localPath, vaultId);
                            
                            // On stocke l'URL de notre PROXY interne
                            level[field][i] = `/api/structure/proxy/${cloudFile.id}`; 
                            
                            try { fs.unlinkSync(localPath); } catch(e) {}
                        }
                    }
                }
            }
        }
    }

    let result = data._id ? 
        await Homework.findByIdAndUpdate(data._id, data, { new: true }) : 
        await Homework.create(data);

    res.json(result);
}));

router.get('/all', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('Homework').find({}).sort({ date: -1 }).lean());
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    await mongoose.model('Homework').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
}));

module.exports = router;