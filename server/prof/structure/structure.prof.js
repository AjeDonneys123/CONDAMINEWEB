// @signatures: ProfStructureRouter, chapters, sections, deleteActivityRequest, deleteChapterRequest, moveChapter, moveActivity, proxy
const express = require('express');
const router = express.Router();
const { Chapter, Teacher, Admin, Classroom, Homework, GameLevel, LearningModule, Expose, Lecture, Fiche, Production, RevisionActivity } = require('../models/prof.models');
const ProfDrive = require('../core/drive.prof');
const mongoose = require('mongoose');

/**
 * 🛠️ BLOC STRUCTURE PROF V451 - AUTO CH1 FIX
 * RÔLE : Gestion des sections et dossiers + Proxy d'images partagé.
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

        if (oldName && oldName.toUpperCase() !== name) {
            const idx = user.subjectSections.findIndex(s => s.name === oldName.toUpperCase());
            if (idx !== -1) {
                user.subjectSections[idx].name = name;
                if (color) user.subjectSections[idx].color = color;
                if (scope) user.subjectSections[idx].scope = scope;
                if (target) user.subjectSections[idx].target = target;
                await Chapter.updateMany({ teacherId: user._id, section: oldName.toUpperCase() }, { $set: { section: name } });
            }
        } else {
            const existingIdx = user.subjectSections.findIndex(s => s.name === name);
            if (existingIdx !== -1) {
                if (color) user.subjectSections[existingIdx].color = color;
                if (scope) user.subjectSections[existingIdx].scope = scope;
                if (target) user.subjectSections[existingIdx].target = target;
            } else {
                // ➤ CRÉATION NOUVELLE SECTION
                user.subjectSections.push({ name, color: color || getRandomColor(), scope: scope || 'GLOBAL', target: target || null, hiddenIn: [] });
                
                // ➤ AUTO-CREATION DU CH1 (Le Fix est ici)
                console.log(`✨ [STRUCTURE] Auto-création CH1 pour la section : ${name}`);
                await Chapter.create({
                    title: "CH1",
                    section: name,
                    teacherId: user._id,
                    classroom: (scope === 'CLASS') ? (target || "") : "", 
                    sharedLevel: (scope === 'LEVEL') ? (target || "") : "", 
                    isArchived: false
                });
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
            await Chapter.updateMany({ teacherId: user._id, section: sectionName.toUpperCase() }, { $set: { section: "GÉNÉRAL" } });
            const root = await Chapter.findOne({ teacherId: user._id, section: "GÉNÉRAL", title: "GÉNÉRAL" });
            if (!root) await Chapter.create({ title: "GÉNÉRAL", section: "GÉNÉRAL", teacherId: user._id, isArchived: false });
            user.subjectSections = user.subjectSections.filter(s => s.name !== sectionName.toUpperCase());
        } else {
            const section = user.subjectSections.find(s => s.name === sectionName.toUpperCase());
            if (section) {
                if (!section.hiddenIn) section.hiddenIn = [];
                if (!section.hiddenIn.includes(classId)) section.hiddenIn.push(classId);
                
                // --- AJOUT CRITIQUE POUR LA PERSISTANCE ---
                user.markModified('subjectSections');
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
            const root = await Chapter.findOne({ teacherId, section: "GÉNÉRAL", title: "GÉNÉRAL" });
            if (!root) await Chapter.create({ title: "GÉNÉRAL", section: "GÉNÉRAL", teacherId, isArchived: false });
            const allChaps = await Chapter.find({ teacherId }).sort({ createdAt: 1 });
            const registry = {}; const toDelete = [];
            for (const c of allChaps) {
                const key = `${c.section}_${c.title}`.toUpperCase().trim();
                if (!registry[key]) registry[key] = c._id;
                else {
                    await Homework.updateMany({ chapterId: c._id }, { chapterId: registry[key] });
                    await GameLevel.updateMany({ chapterId: c._id }, { chapterId: registry[key] });
                    await LearningModule.updateMany({ chapterId: c._id }, { chapterId: registry[key] });
                    await Expose.updateMany({ chapterId: c._id }, { chapterId: registry[key] });
                    await Lecture.updateMany({ chapterId: c._id }, { chapterId: registry[key] });
                    await Fiche.updateMany({ chapterId: c._id }, { chapterId: registry[key] });
                    await RevisionActivity.updateMany({ chapterId: c._id }, { chapterId: registry[key] });
                    toDelete.push(c._id);
                }
            }
            if (toDelete.length > 0) await Chapter.deleteMany({ _id: { $in: toDelete } });
        }
        const query = isValidId ? { teacherId } : {};
        if (classContext) query.hiddenIn = { $ne: classContext };
        const chapters = await Chapter.find(query).sort({ createdAt: -1 }).lean();
        res.json(chapters.map(c => ({ ...c, _id: String(c._id) })));
    } catch (e) { res.json([]); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { title, section, scope, target, teacherId } = req.body;
        const cleanTitle = (title || "NOUVEAU").toUpperCase().trim();
        const cleanSection = (section || "GÉNÉRAL").toUpperCase().trim();
        const existing = await Chapter.findOne({ teacherId, section: cleanSection, title: cleanTitle });
        if (existing) {
            existing.classroom = scope === 'CLASS' ? target : "";
            existing.sharedLevel = scope === 'LEVEL' ? target : "";
            await existing.save();
            return res.json(existing);
        }
        const newChap = await Chapter.create({ title: cleanTitle, section: cleanSection, classroom: scope === 'CLASS' ? target : "", sharedLevel: scope === 'LEVEL' ? target : "", teacherId, isArchived: false });
        res.json(newChap);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/chapters/:id', async (req, res) => {
    try {
        const { title, scope, target, isArchived, section } = req.body;
        const up = {};
        if (title) up.title = title.toUpperCase().trim();
        if (section) up.section = section.toUpperCase().trim();
        if (scope) { up.classroom = scope === 'CLASS' ? target : ""; up.sharedLevel = scope === 'LEVEL' ? target : ""; }
        if (isArchived !== undefined) up.isArchived = isArchived;
        const updated = await Chapter.findByIdAndUpdate(req.params.id, up, { new: true });
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/chapters/delete-request', async (req, res) => {
    try {
        const { chapterId, classId, permanent, teacherId } = req.body;
        const target = await Chapter.findById(chapterId);
        if (permanent) {
            await Chapter.findByIdAndDelete(chapterId);
            if (target.section.toUpperCase() === "GÉNÉRAL") {
                const remaining = await Chapter.find({ teacherId, section: "GÉNÉRAL" });
                if (remaining.length === 0) await Chapter.create({ title: "GÉNÉRAL", section: "GÉNÉRAL", teacherId, isArchived: false });
            }
        } else {
            await Chapter.findByIdAndUpdate(chapterId, { $addToSet: { hiddenIn: classId } });
        }
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- 3. ACTIVITÉS (DELETE & MOVE) ---

router.post('/activity/delete-request', async (req, res) => {
    try {
        const { id, type } = req.body;
        
        // Suppression Devoir
        if (type === 'homework') {
            await Homework.findByIdAndDelete(id);
            return res.json({ ok: true });
        }
        
        // Suppression Jeu
        if (['game', 'zombie', 'starship'].includes(type) || !type) {
            await GameLevel.findByIdAndDelete(id);
            // Optionnel : Supprimer la progression associée ?
            // await GameProgress.deleteMany({ gameId: id });
            return res.json({ ok: true });
        }

        if (type === 'learning') {
            await LearningModule.findByIdAndDelete(id);
            return res.json({ ok: true });
        }

        if (type === 'expose') {
            await Expose.findByIdAndDelete(id);
            return res.json({ ok: true });
        }

        if (type === 'lecture') {
            await Lecture.findByIdAndDelete(id);
            return res.json({ ok: true });
        }

        if (type === 'fiche') {
            await Fiche.findByIdAndDelete(id);
            return res.json({ ok: true });
        }

        if (type === 'production') {
            await Production.findByIdAndDelete(id);
            return res.json({ ok: true });
        }

        if (type === 'revision') {
            await RevisionActivity.findByIdAndDelete(id);
            return res.json({ ok: true });
        }

        res.status(400).json({ error: "Type inconnu" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- 4. UTILITAIRES ---

router.get('/sections/:teacherId', async (req, res) => {
    try {
        const { teacherId } = req.params;
        const { classContext } = req.query;
        if (!teacherId || teacherId === 'undefined' || !mongoose.Types.ObjectId.isValid(teacherId)) return res.json([{ name: 'GÉNÉRAL', color: '#64748b', scope: 'GLOBAL' }]);
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
    } catch (e) { 
        console.error("❌ Proxy Error:", e.message);
        res.status(404).send("Drive Error"); 
    }
});

module.exports = router;
