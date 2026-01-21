const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const StructureExpert = require('./experts/structure.expert');
const StructureDrive = require('./experts/structure.drive');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * 🛣️ ROUTES STRUCTURE V139 - SHARED LEVELS
 * Fix : Support de la création de chapitres partagés par niveau (sharedLevel).
 */

// --- ROUTES STANDARDS ---
router.get('/integrity/:homeworkId', asyncHandler(async (req, res) => res.json(await StructureExpert.verifyAssetsIntegrity(req.params.homeworkId))));
router.get('/drive-tree', async (req, res) => { try { res.json(await StructureDrive.getDriveTree()); } catch (e) { res.json({ name: "Conda Vault", children: [], error: e.message }); } });
router.post('/sync-root', asyncHandler(async (req, res) => res.json(await StructureDrive.syncBaseStructure())));
router.get('/chapters', asyncHandler(async (req, res) => res.json(await StructureExpert.getChapters())));

// --- CRÉATION CHAPITRE (MISE À JOUR V139) ---
router.post('/chapters', asyncHandler(async (req, res) => {
    // On passe directement le body à l'expert ou au modèle
    // Le champ sharedLevel sera pris en compte automatiquement par le modèle Mongoose
    const result = await StructureExpert.createChapter(req.body);
    res.json(result);
}));

router.delete('/chapters/:id', asyncHandler(async (req, res) => { await StructureExpert.deleteChapter(req.params.id); res.json({ ok: true }); }));
router.patch('/chapters/:id/archive', asyncHandler(async (req, res) => { const updated = await mongoose.model('Chapter').findByIdAndUpdate(req.params.id, { isArchived: !!req.body.isArchived }, { new: true }); res.json(updated); }));
router.delete('/drive/:id', asyncHandler(async (req, res) => res.json(await StructureDrive.deleteDriveItem(req.params.id))));

// --- SECTIONS (INCHANGÉ V136) ---
router.get('/sections/:teacherId', asyncHandler(async (req, res) => {
    if (!req.params.teacherId || req.params.teacherId === 'undefined') return res.json([]);
    let user = await mongoose.model('Teacher').findById(req.params.teacherId) || await mongoose.model('Admin').findById(req.params.teacherId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user.subjectSections || []);
}));

router.post('/sections', asyncHandler(async (req, res) => {
    const { teacherId, sectionName } = req.body;
    if (!teacherId || !sectionName) return res.status(400).json({ error: "Données manquantes" });
    const cleanName = sectionName.toUpperCase().trim();
    let user = await mongoose.model('Teacher').findById(teacherId) || await mongoose.model('Admin').findById(teacherId);
    if (!user) return res.status(404).json({ error: "User not found" });
    
    // Nettoyage et Ajout
    const getRandomColor = () => { const l='0123456789ABCDEF'; let c='#'; for(let i=0;i<6;i++) c+=l[Math.floor(Math.random()*16)]; return c; };
    let sections = [];
    if(user.subjectSections) sections = user.subjectSections.filter(s=>s.name); // Clean nulls
    
    if (sections.length === 0 && cleanName !== 'GÉNÉRAL') sections.push({ name: 'GÉNÉRAL', color: '#64748b' });
    if (!sections.some(s => s.name === cleanName)) sections.push({ name: cleanName, color: getRandomColor() });

    user.subjectSections = sections;
    user.markModified('subjectSections');
    await user.save();
    res.json(user.subjectSections);
}));

router.delete('/sections', asyncHandler(async (req, res) => {
    const { teacherId, sectionName } = req.body;
    const targetName = sectionName.toUpperCase().trim();
    let user = await mongoose.model('Teacher').findById(teacherId) || await mongoose.model('Admin').findById(teacherId);
    if (!user) return res.status(404).json({ error: "User not found" });

    let sections = user.subjectSections || [];
    if (sections.length <= 1) return res.status(400).json({ error: "Il doit rester au moins une section." });

    sections = sections.filter(s => s.name !== targetName);
    user.subjectSections = sections;
    user.markModified('subjectSections');
    await user.save();
    res.json(user.subjectSections);
}));

router.post('/sections/reset', asyncHandler(async (req, res) => {
    const { teacherId } = req.body;
    let user = await mongoose.model('Teacher').findById(teacherId) || await mongoose.model('Admin').findById(teacherId);
    if (!user) return res.status(404).json({ error: "User not found" });
    user.subjectSections = [{ name: 'GÉNÉRAL', color: '#64748b' }];
    user.markModified('subjectSections');
    await user.save();
    res.json(user.subjectSections);
}));

module.exports = router;