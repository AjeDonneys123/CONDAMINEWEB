const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const StructureExpert = require('./experts/structure.expert');
const StructureDrive = require('./experts/structure.drive');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * 🛣️ ROUTES STRUCTURE V94
 */

// DIAGNOSTIC D'INTÉGRITÉ DES LIENS DRIVE (Utilisé par le GARDien)
router.get('/integrity/:homeworkId', asyncHandler(async (req, res) => {
    res.json(await StructureExpert.verifyAssetsIntegrity(req.params.homeworkId));
}));

router.get('/drive-tree', async (req, res) => {
    try {
        const tree = await StructureDrive.getDriveTree();
        res.json(tree);
    } catch (e) {
        res.json({ name: "Conda Vault", children: [], error: e.message });
    }
});

router.post('/sync-root', asyncHandler(async (req, res) => {
    res.json(await StructureDrive.syncBaseStructure());
}));

router.get('/chapters', asyncHandler(async (req, res) => {
    res.json(await StructureExpert.getChapters());
}));

router.post('/chapters', asyncHandler(async (req, res) => {
    res.json(await StructureExpert.createChapter(req.body));
}));

router.delete('/chapters/:id', asyncHandler(async (req, res) => {
    await StructureExpert.deleteChapter(req.params.id);
    res.json({ ok: true });
}));

router.patch('/chapters/:id/archive', asyncHandler(async (req, res) => {
    const updated = await mongoose.model('Chapter').findByIdAndUpdate(
        req.params.id, 
        { isArchived: !!req.body.isArchived }, 
        { new: true }
    );
    res.json(updated);
}));

router.delete('/drive/:id', asyncHandler(async (req, res) => {
    res.json(await StructureDrive.deleteDriveItem(req.params.id));
}));

module.exports = router;