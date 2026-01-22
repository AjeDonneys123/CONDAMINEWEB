const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const StructureExpert = require('./experts/structure.expert');
const StructureDrive = require('./experts/structure.drive');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * 🛣️ ROUTES STRUCTURE V193 - FIX PROXY IMAGE
 * Ajout de la route /proxy/:id indispensable pour afficher les images Drive aux élèves.
 */

// --- ROUTE PROXY CRITIQUE POUR LES IMAGES ---
router.get('/proxy/:id', async (req, res) => {
    try {
        // On récupère le flux (stream) de l'image depuis Google Drive
        const stream = await StructureDrive.getFileStream(req.params.id);
        // On le "pipe" (déverse) directement vers le navigateur de l'élève
        stream.pipe(res);
    } catch (e) {
        console.error("Proxy Error:", e.message);
        // Si image pas trouvée, on renvoie une 404 (ce qui affiche le carré blanc, mais là ça devrait marcher)
        res.status(404).send("Image introuvable");
    }
});

// --- ROUTES STANDARDS ---
router.get('/integrity/:homeworkId', asyncHandler(async (req, res) => res.json(await StructureExpert.verifyAssetsIntegrity(req.params.homeworkId))));
router.get('/drive-tree', async (req, res) => { try { res.json(await StructureDrive.getDriveTree()); } catch (e) { res.json({ name: "Conda Vault", children: [], error: e.message }); } });
router.post('/sync-root', asyncHandler(async (req, res) => res.json(await StructureDrive.syncBaseStructure())));
router.get('/chapters', asyncHandler(async (req, res) => res.json(await StructureExpert.getChapters())));
router.post('/chapters', asyncHandler(async (req, res) => res.json(await StructureExpert.createChapter(req.body))));
router.delete('/chapters/:id', asyncHandler(async (req, res) => { await StructureExpert.deleteChapter(req.params.id); res.json({ ok: true }); }));
router.patch('/chapters/:id/archive', asyncHandler(async (req, res) => { const updated = await mongoose.model('Chapter').findByIdAndUpdate(req.params.id, { isArchived: !!req.body.isArchived }, { new: true }); res.json(updated); }));
router.delete('/drive/:id', asyncHandler(async (req, res) => res.json(await StructureDrive.deleteDriveItem(req.params.id))));

// Helper Couleur
const getRandomColor = () => `hsl(${Math.floor(Math.random() * 360)}, 85%, 60%)`;

// --- LECTURE SECTIONS ---
router.get('/sections/:teacherId', asyncHandler(async (req, res) => {
    if (!req.params.teacherId || req.params.teacherId === 'undefined') return res.json([]);
    let user = await mongoose.model('Teacher').findById(req.params.teacherId) || await mongoose.model('Admin').findById(req.params.teacherId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user.subjectSections || []);
}));

// --- CRÉATION SECTIONS ---
router.post('/sections', asyncHandler(async (req, res) => {
    const { teacherId, sectionName, scope, target } = req.body;
    if (!teacherId || !sectionName) return res.status(400).json({ error: "Données manquantes" });
    const cleanName = sectionName.toUpperCase().trim();
    let user = await mongoose.model('Teacher').findById(teacherId) || await mongoose.model('Admin').findById(teacherId);
    if (!user) return res.status(404).json({ error: "User not found" });

    let oldSections = user.subjectSections || [];
    let newSections = [];
    for(let s of oldSections) { if(s && s.name) newSections.push({ name: s.name, color: s.color || getRandomColor(), scope: s.scope || 'GLOBAL', target: s.target || null }); }
    if (newSections.length === 0 && cleanName !== 'GÉNÉRAL') newSections.push({ name: 'GÉNÉRAL', color: '#64748b', scope: 'GLOBAL' });

    const isDuplicate = newSections.some(s => s.name === cleanName && s.scope === (scope || 'GLOBAL') && s.target === (target || null));
    if (isDuplicate) return res.status(409).json({ error: `La section "${cleanName}" existe déjà ici !` });

    newSections.push({ name: cleanName, color: getRandomColor(), scope: scope || 'GLOBAL', target: target || null });
    user.subjectSections = newSections; user.markModified('subjectSections'); await user.save();
    res.json(user.subjectSections);
}));

// --- SUPPRESSION SECTIONS ---
router.delete('/sections', asyncHandler(async (req, res) => {
    const { teacherId, sectionName } = req.body;
    const targetName = sectionName.toUpperCase().trim();
    let user = await mongoose.model('Teacher').findById(teacherId) || await mongoose.model('Admin').findById(teacherId);
    if (!user) return res.status(404).json({ error: "User not found" });
    let oldSections = user.subjectSections || [];
    let newSections = [];
    for(let s of oldSections) { if(s && s.name && s.name !== targetName) newSections.push(s); }
    if (newSections.length === 0) newSections.push({ name: 'GÉNÉRAL', color: '#64748b', scope: 'GLOBAL' });
    user.subjectSections = newSections; user.markModified('subjectSections'); await user.save();
    res.json(user.subjectSections);
}));

// --- RESET SECTIONS ---
router.post('/sections/reset', asyncHandler(async (req, res) => {
    const { teacherId } = req.body;
    let user = await mongoose.model('Teacher').findById(teacherId) || await mongoose.model('Admin').findById(teacherId);
    if (!user) return res.status(404).json({ error: "User not found" });
    user.subjectSections = [{ name: 'GÉNÉRAL', color: '#64748b', scope: 'GLOBAL' }];
    user.markModified('subjectSections'); await user.save();
    res.json(user.subjectSections);
}));

module.exports = router;