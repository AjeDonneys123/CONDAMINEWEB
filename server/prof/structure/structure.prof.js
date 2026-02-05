// @signatures: ProfStructureRouter, chapters, sections, deleteActivityRequest, deleteChapterRequest, moveChapter, moveActivity, proxy
const express = require('express');
const router = express.Router();
const { Chapter, Teacher, Admin, Classroom, Homework, GameLevel, ScanSession } = require('../models/prof.models');
const ProfDrive = require('../core/drive.prof');
const mongoose = require('mongoose');

/**
 * 🛠️ BLOC STRUCTURE PROF V465 - FIX RESTORATION
 * RÔLE : Gestion des sections et dossiers avec fusion (Upsert) et renommage en cascade.
 */

const getRandomColor = () => `hsl(${Math.floor(Math.random() * 360)}, 85%, 60%)`;

// --- 1. SECTIONS ---

router.post('/sections', async (req, res) => {
    try {
        const { teacherId, oldName, sectionName, color, scope, target } = req.body;
        const user = await Teacher.findById(teacherId) || await Admin.findById(teacherId);
        if (!user) return res.status(404).json({ error: "Prof introuvable" });

        const name = sectionName.toUpperCase().trim();
        if (name === "GÉNÉRAL") return res.json(user.subjectSections);

        if (!user.subjectSections) user.subjectSections = [];

        // CAS A : RENOMMAGE (Cascade)
        if (oldName && oldName.toUpperCase() !== name) {
            const idx = user.subjectSections.findIndex(s => s.name === oldName.toUpperCase());
            if (idx !== -1) {
                user.subjectSections[idx].name = name;
                if (color) user.subjectSections[idx].color = color;
                if (scope) user.subjectSections[idx].scope = scope;
                if (target) user.subjectSections[idx].target = target;
                
                // Cascade sur les dossiers
                await Chapter.updateMany(
                    { teacherId: user._id, section: oldName.toUpperCase() }, 
                    { $set: { section: name } }
                );
            }
        } 
        // CAS B : MISE À JOUR OU CRÉATION
        else {
            const existingIdx = user.subjectSections.findIndex(s => s.name === name);
            if (existingIdx !== -1) {
                if (color) user.subjectSections[existingIdx].color = color;
                if (scope) user.subjectSections[existingIdx].scope = scope;
                if (target) user.subjectSections[existingIdx].target = target;
            } else {
                // Création
                const isFirstCustom = user.subjectSections.length === 1 && user.subjectSections[0].name === "GÉNÉRAL";
                
                user.subjectSections.push({ 
                    name, 
                    color: color || getRandomColor(), 
                    scope: scope || 'GLOBAL', 
                    target: target || null, 
                    hiddenIn: [] 
                });

                // Migration auto si première section
                if (isFirstCustom) {
                    const generalRoot = await Chapter.findOne({ teacherId: user._id, section: "GÉNÉRAL", title: "GÉNÉRAL" });
                    const newCh1 = await Chapter.create({ title: "CH1", section: name, teacherId: user._id });
                    if (generalRoot) {
                        await Homework.updateMany({ chapterId: generalRoot._id }, { chapterId: newCh1._id });
                        await GameLevel.updateMany({ chapterId: generalRoot._id }, { chapterId: newCh1._id });
                        await ScanSession.updateMany({ chapterId: generalRoot._id }, { chapterId: newCh1._id });
                    }
                }
            }
        }
        await user.save();
        res.json(user.subjectSections);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/sections/delete-request', async (req, res) => {
    try {
        const { teacherId, sectionName, permanent, classId } = req.body;
        const user = await Teacher.findById(teacherId) || await Admin.findById(teacherId);
        if (!user) return res.status(404).json({ error: "Prof introuvable" });

        if (permanent) {
            // Migration vers GÉNÉRAL avant suppression
            await Chapter.updateMany({ teacherId: user._id, section: sectionName.toUpperCase() }, { $set: { section: "GÉNÉRAL" } });
            user.subjectSections = user.subjectSections.filter(s => s.name !== sectionName.toUpperCase());
        } else {
            const section = user.subjectSections.find(s => s.name === sectionName.toUpperCase());
            if (section) {
                if (!section.hiddenIn) section.hiddenIn = [];
                if (!section.hiddenIn.includes(classId)) section.hiddenIn.push(classId);
            }
        }
        await user.save();
        res.json(user.subjectSections);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- 2. CHAPITRES ---

router.get('/chapters', async (req, res) => {
    try {
        const { teacherId, classContext } = req.query;
        const isValidId = teacherId && teacherId !== 'undefined' && mongoose.Types.ObjectId.isValid(teacherId);
        
        if (isValidId) {
            // Garantir racine
            const root = await Chapter.findOne({ teacherId, section: "GÉNÉRAL", title: "GÉNÉRAL" });
            if (!root) await Chapter.create({ title: "GÉNÉRAL", section: "GÉNÉRAL", teacherId, isArchived: false });
            
            // Fusion des doublons par Nom+Section
            const allChaps = await Chapter.find({ teacherId }).sort({ createdAt: 1 });
            const registry = {}; const toDelete = [];
            for (const c of allChaps) {
                const key = `${c.section}_${c.title}`.toUpperCase().trim();
                if (!registry[key]) registry[key] = c._id;
                else { 
                    await Homework.updateMany({ chapterId: c._id }, { chapterId: registry[key] }); 
                    await GameLevel.updateMany({ chapterId: c._id }, { chapterId: registry[key] }); 
                    toDelete.push(c._id); 
                }
            }
            if (toDelete.length > 0) await Chapter.deleteMany({ _id: { $in: toDelete } });
        }

        const query = isValidId ? { teacherId } : {};
        if (classContext) query.hiddenIn = { $ne: classContext };
        const chapters = await Chapter.find(query).sort({ title: 1 }).lean();
        res.json(chapters.map(c => ({ ...c, _id: String(c._id) })));
    } catch (e) { res.json([]); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { title, section, scope, target, teacherId } = req.body;
        const cleanTitle = (title || "NOUVEAU").toUpperCase().trim();
        const cleanSection = (section || "GÉNÉRAL").toUpperCase().trim();
        
        // UPSERT LOGIC
        const existing = await Chapter.findOne({ teacherId, section: cleanSection, title: cleanTitle });
        if (existing) {
            existing.classroom = scope === 'CLASS' ? target : "";
            existing.sharedLevel = scope === 'LEVEL' ? target : "";
            await existing.save();
            return res.json(existing);
        }
        const newChap = await Chapter.create({ 
            title: cleanTitle, 
            section: cleanSection, 
            classroom: scope === 'CLASS' ? target : "", 
            sharedLevel: scope === 'LEVEL' ? target : "", 
            teacherId, 
            isArchived: false 
        });
        res.json(newChap);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/chapters/:id', async (req, res) => {
    try {
        const { title, scope, target, isArchived } = req.body;
        const up = {};
        if (title) up.title = title.toUpperCase().trim();
        if (scope) { 
            up.classroom = scope === 'CLASS' ? target : ""; 
            up.sharedLevel = scope === 'LEVEL' ? target : ""; 
        }
        if (isArchived !== undefined) up.isArchived = isArchived;
        const updated = await Chapter.findByIdAndUpdate(req.params.id, up, { new: true });
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/chapters/delete-request', async (req, res) => {
    try {
        const { chapterId, classId, permanent, teacherId } = req.body;
        const target = await Chapter.findById(chapterId);
        if (!target) return res.status(404).json({ error: "Introuvable" });

        if (permanent) {
            // Migration vers racine avant suppression
            let root = await Chapter.findOne({ teacherId, section: "GÉNÉRAL", title: "GÉNÉRAL" });
            if (!root) root = await Chapter.create({ title: "GÉNÉRAL", section: "GÉNÉRAL", teacherId });
            
            await Homework.updateMany({ chapterId }, { chapterId: root._id });
            await GameLevel.updateMany({ chapterId }, { chapterId: root._id });
            
            await Chapter.findByIdAndDelete(chapterId);
        } else {
            await Chapter.findByIdAndUpdate(chapterId, { $addToSet: { hiddenIn: classId } });
        }
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- 3. ACTIVITÉS ---

router.post('/activity/delete-request', async (req, res) => {
    try {
        const { id, type } = req.body;
        if (type === 'homework') await Homework.findByIdAndDelete(id);
        else await GameLevel.findByIdAndDelete(id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/sections/:teacherId', async (req, res) => {
    try {
        const { teacherId } = req.params;
        const { classContext } = req.query;
        if (!teacherId || teacherId === 'undefined' || !mongoose.Types.ObjectId.isValid(teacherId)) 
            return res.json([{ name: 'GÉNÉRAL', color: '#64748b', scope: 'GLOBAL' }]);
        
        const user = await Teacher.findById(teacherId).lean() || await Admin.findById(teacherId).lean();
        const cls = classContext ? await Classroom.findOne({ name: classContext }).lean() : null;
        
        let sections = (user.subjectSections || []).filter(s => s.name.toUpperCase() !== "GÉNÉRAL");
        const filtered = sections.filter(s => {
            if (s.hiddenIn && s.hiddenIn.includes(classContext)) return false;
            if (s.scope === 'GLOBAL') return true;
            if (s.scope === 'LEVEL' && cls && String(s.target) === String(cls.level)) return true;
            if (s.scope === 'CLASS' && s.target === classContext) return true;
            return false;
        });
        filtered.unshift({ name: 'GÉNÉRAL', color: '#64748b', scope: 'GLOBAL' });
        res.json(filtered);
    } catch (e) { res.json([{ name: 'GÉNÉRAL', color: '#64748b', scope: 'GLOBAL' }]); }
});

router.get('/proxy/:id', async (req, res) => {
    try {
        const stream = await ProfDrive.getFileStream(req.params.id);
        res.setHeader('Content-Type', 'image/png');
        stream.pipe(res);
    } catch (e) { res.status(404).send("Drive Error"); }
});

module.exports = router;
