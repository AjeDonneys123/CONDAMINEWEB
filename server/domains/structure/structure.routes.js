const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const StructureExpert = require('./experts/structure.expert');
const StructureDrive = require('./experts/structure.drive');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/proxy/:id', async (req, res) => { try { const stream = await StructureDrive.getFileStream(req.params.id); stream.pipe(res); } catch (e) { res.status(404).send("Image introuvable"); } });
router.get('/integrity/:homeworkId', asyncHandler(async (req, res) => res.json(await StructureExpert.verifyAssetsIntegrity(req.params.homeworkId))));
router.get('/drive-tree', async (req, res) => { try { res.json(await StructureDrive.getDriveTree()); } catch (e) { res.json({ name: "Conda Vault", children: [], error: e.message }); } });
router.post('/sync-root', asyncHandler(async (req, res) => res.json(await StructureDrive.syncBaseStructure())));
router.get('/chapters', asyncHandler(async (req, res) => res.json(await StructureExpert.getChapters())));
router.post('/chapters', asyncHandler(async (req, res) => res.json(await StructureExpert.createChapter(req.body))));
router.delete('/chapters/:id', asyncHandler(async (req, res) => { await StructureExpert.deleteChapter(req.params.id); res.json({ ok: true }); }));
router.patch('/chapters/:id/archive', asyncHandler(async (req, res) => { const updated = await mongoose.model('Chapter').findByIdAndUpdate(req.params.id, { isArchived: !!req.body.isArchived }, { new: true }); res.json(updated); }));
router.delete('/drive/:id', asyncHandler(async (req, res) => res.json(await StructureDrive.deleteDriveItem(req.params.id))));
const getRandomColor = () => `hsl(${Math.floor(Math.random() * 360)}, 85%, 60%)`;

// RENOMMAGE (V435)
router.patch('/chapters/:id', asyncHandler(async (req, res) => {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: "Titre manquant" });
    const updated = await mongoose.model('Chapter').findByIdAndUpdate(req.params.id, { title: title.toUpperCase().trim() }, { new: true });
    res.json(updated);
}));

router.get('/sections/:teacherId', asyncHandler(async (req, res) => {
    if (!req.params.teacherId || req.params.teacherId === 'undefined') return res.json([]);
    let user = await mongoose.model('Teacher').findById(req.params.teacherId) || await mongoose.model('Admin').findById(req.params.teacherId);
    if (!user) return res.status(404).json({ error: "User not found" });
    
    if (!user.subjectSections || user.subjectSections.length === 0) {
        user.subjectSections = [{ name: 'GÉNÉRAL', color: '#64748b', scope: 'GLOBAL' }];
        await user.save();
    }

    const Chapter = mongoose.model('Chapter');
    const Homework = mongoose.model('Homework');
    const GameLevel = mongoose.model('GameLevel');
    const ScanSession = mongoose.model('ScanSession');

    for (const section of user.subjectSections) {
        if (section.name === "GÉNÉRAL") {
             const globalGeneral = await Chapter.findOne({ teacherId: user._id, section: "GÉNÉRAL", title: "GÉNÉRAL" });
             if (!globalGeneral) await Chapter.create({ title: "GÉNÉRAL", section: "GÉNÉRAL", classroom: "", teacherId: user._id, isArchived: false });
             continue;
        }

        // Nettoyage des "Général" parasites dans les sections custom
        const parasite = await Chapter.findOne({ teacherId: user._id, section: section.name, title: "GÉNÉRAL" });
        if (parasite) {
            const ch1 = await Chapter.findOne({ teacherId: user._id, section: section.name, title: "CH1" });
            if (ch1) {
                await Homework.updateMany({ chapterId: parasite._id }, { chapterId: ch1._id });
                await GameLevel.updateMany({ chapterId: parasite._id }, { chapterId: ch1._id });
                await ScanSession.updateMany({ chapterId: parasite._id }, { chapterId: ch1._id });
                await Chapter.findByIdAndDelete(parasite._id);
            } else {
                parasite.title = "CH1";
                await parasite.save();
            }
        }
    }
    res.json(user.subjectSections || []);
}));

// --- V435 : MIGRATION AUTOMATIQUE DU CONTENU GÉNÉRAL VERS LA PREMIÈRE SECTION ---
router.post('/sections', asyncHandler(async (req, res) => { 
    const { teacherId, sectionName, scope, target } = req.body; 
    if (!teacherId || !sectionName) return res.status(400).json({ error: "Données manquantes" }); 
    const cleanName = sectionName.toUpperCase().trim(); 
    let user = await mongoose.model('Teacher').findById(teacherId) || await mongoose.model('Admin').findById(teacherId); 
    if (!user) return res.status(404).json({ error: "User not found" }); 
    
    let sections = user.subjectSections || []; 
    const isDuplicate = sections.some(s => s.name === cleanName && s.scope === (scope || 'GLOBAL') && s.target === (target || null)); 
    if (isDuplicate) return res.status(409).json({ error: `La section "${cleanName}" existe déjà !` }); 
    
    // DÉTECTION PREMIÈRE SECTION (Si on n'avait que "GÉNÉRAL" avant)
    const isFirstCustomSection = sections.length === 1 && sections[0].name === "GÉNÉRAL";

    sections.push({ name: cleanName, color: getRandomColor(), scope: scope || 'GLOBAL', target: target || null }); 
    user.subjectSections = sections; 
    await user.save(); 
    
    const newCh1 = await mongoose.model('Chapter').create({ 
        title: "CH1", 
        section: cleanName, 
        classroom: (scope === 'CLASS') ? (target || "") : "", 
        teacherId: user._id, 
        isArchived: false 
    }); 

    // MIGRATION DU CONTENU
    if (isFirstCustomSection) {
        console.log(`🚀 [FIRST-SECTION] Migration du contenu 'GÉNÉRAL' vers '${cleanName} > CH1'`);
        const generalChap = await mongoose.model('Chapter').findOne({ teacherId: user._id, section: "GÉNÉRAL", title: "GÉNÉRAL" });
        
        if (generalChap) {
            const Homework = mongoose.model('Homework');
            const GameLevel = mongoose.model('GameLevel');
            const ScanSession = mongoose.model('ScanSession');

            await Homework.updateMany({ chapterId: generalChap._id }, { chapterId: newCh1._id });
            await GameLevel.updateMany({ chapterId: generalChap._id }, { chapterId: newCh1._id });
            await ScanSession.updateMany({ chapterId: generalChap._id }, { chapterId: newCh1._id });
        }
    }
    
    res.json(user.subjectSections); 
}));

router.delete('/sections', asyncHandler(async (req, res) => { 
    const { teacherId, sectionName } = req.body; 
    let user = await mongoose.model('Teacher').findById(teacherId) || await mongoose.model('Admin').findById(teacherId); 
    if (!user) return res.status(404).json({ error: "User not found" }); 
    
    const Chapter = mongoose.model('Chapter');
    const Homework = mongoose.model('Homework');
    const GameLevel = mongoose.model('GameLevel');
    const ScanSession = mongoose.model('ScanSession');

    let fallback = await Chapter.findOne({ teacherId: user._id, section: "GÉNÉRAL", title: "GÉNÉRAL" });
    if (!fallback) fallback = await Chapter.create({ teacherId: user._id, section: "GÉNÉRAL", title: "GÉNÉRAL", classroom: "" });

    const chaptersToDelete = await Chapter.find({ teacherId: user._id, section: sectionName });
    const idsToDelete = chaptersToDelete.map(c => c._id);

    if (idsToDelete.length > 0) {
        console.log(`♻️ [SECTION-DELETE] Migration de ${idsToDelete.length} dossiers vers GÉNÉRAL.`);
        await Homework.updateMany({ chapterId: { $in: idsToDelete } }, { chapterId: fallback._id });
        await GameLevel.updateMany({ chapterId: { $in: idsToDelete } }, { chapterId: fallback._id });
        await ScanSession.updateMany({ chapterId: { $in: idsToDelete } }, { chapterId: fallback._id });
        
        await Chapter.deleteMany({ _id: { $in: idsToDelete } });
    }

    let newSections = user.subjectSections.filter(s => s.name !== sectionName); 
    if (newSections.length === 0) newSections.push({ name: 'GÉNÉRAL', color: '#64748b', scope: 'GLOBAL' }); 
    user.subjectSections = newSections; 
    await user.save(); 
    
    res.json(user.subjectSections); 
}));

router.post('/sections/reset', asyncHandler(async (req, res) => { const { teacherId } = req.body; let user = await mongoose.model('Teacher').findById(teacherId) || await mongoose.model('Admin').findById(teacherId); user.subjectSections = [{ name: 'GÉNÉRAL', color: '#64748b', scope: 'GLOBAL' }]; await user.save(); await mongoose.model('Chapter').deleteMany({ teacherId: user._id }); await mongoose.model('Chapter').create({ title: "GÉNÉRAL", section: "GÉNÉRAL", classroom: "", teacherId: user._id, isArchived: false }); res.json(user.subjectSections); }));

module.exports = router;