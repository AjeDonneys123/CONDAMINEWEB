const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const StructureExpert = require('./experts/structure.expert');
const StructureDrive = require('./experts/structure.drive');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// MOUCHARD DRIVE
router.get('/drive-tree', async (req, res) => {
    try {
        const tree = await StructureDrive.getDriveTree();
        res.json(tree);
    } catch (e) {
        res.status(200).json({ name: "Erreur Cloud", children: [], error: e.message });
    }
});

// SYNCHRO RACINE ET RÉPARATION ÉLÈVES TEST V58
router.post('/sync-root', asyncHandler(async (req, res) => {
    const result = await StructureDrive.syncBaseStructure();
    res.json(result);
}));

router.delete('/drive/:id', asyncHandler(async (req, res) => {
    const result = await StructureDrive.deleteDriveItem(req.params.id);
    res.json(result);
}));

// SECTIONS
router.post('/sections', asyncHandler(async (req, res) => {
    const { teacherId, sectionName } = req.body;
    let userDoc = await mongoose.model('Teacher').findById(teacherId) || await mongoose.model('Admin').findById(teacherId);
    if (!userDoc) return res.status(404).json({ error: "User not found" });
    const normalized = sectionName.toUpperCase().trim();
    if (!userDoc.subjectSections) userDoc.subjectSections = [];
    if (!userDoc.subjectSections.find(s => s.name === normalized)) {
        const colors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];
        userDoc.subjectSections.push({ name: normalized, color: colors[userDoc.subjectSections.length % colors.length] });
        userDoc.markModified('subjectSections');
        await userDoc.save();
    }
    res.json(userDoc.subjectSections);
}));

router.delete('/sections/:teacherId/:sectionName', asyncHandler(async (req, res) => {
    const normalized = req.params.sectionName.toUpperCase().trim();
    await mongoose.model('Teacher').findByIdAndUpdate(req.params.teacherId, { $pull: { subjectSections: { name: normalized } } });
    await mongoose.model('Admin').findByIdAndUpdate(req.params.teacherId, { $pull: { subjectSections: { name: normalized } } });
    res.json({ ok: true });
}));

// CHAPITRES
router.get('/chapters', asyncHandler(async (req, res) => res.json(await StructureExpert.getChapters())));
router.post('/chapters', asyncHandler(async (req, res) => res.json(await StructureExpert.createChapter(req.body))));
router.patch('/chapters/:id/archive', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('Chapter').findByIdAndUpdate(req.params.id, { isArchived: !!req.body.isArchived }, { new: true }));
}));
router.delete('/chapters/:id', asyncHandler(async (req, res) => {
    await StructureExpert.deleteChapter(req.params.id);
    res.json({ ok: true });
}));

module.exports = router;