// @signatures: ProfStructureRouter, chapters, sections, deleteSection, proxy
const express = require('express');
const router = express.Router();
const { Chapter, Teacher, Admin, Classroom } = require('../models/prof.models');
const ProfDrive = require('../core/drive.prof');

/**
 * 🛠️ BLOC STRUCTURE PROF : GESTION DES SECTIONS ET DOSSIERS
 */

router.get('/chapters', async (req, res) => {
    try {
        // On renvoie TOUS les chapitres (le filtrage isArchived se fait côté front selon le mode)
        const chapters = await Chapter.find({}).sort({ createdAt: -1 }).lean();
        res.json(chapters.map(c => ({
            ...c, _id: String(c._id),
            section: (c.section || "GÉNÉRAL").toUpperCase().trim(),
            classroom: c.classroom ? c.classroom.toUpperCase().trim() : ""
        })));
    } catch (e) { res.status(500).json([]); }
});

router.post('/chapters', async (req, res) => {
    try {
        const { title, section, classroom, sharedLevel, teacherId } = req.body;
        const newChap = await Chapter.create({
            title: title.toUpperCase().trim(),
            section: section.toUpperCase().trim(),
            classroom: sharedLevel ? "" : (classroom || "").toUpperCase().trim(),
            sharedLevel: sharedLevel || "",
            teacherId,
            isArchived: false
        });
        res.json(newChap);
    } catch (e) { res.status(500).send(e.message); }
});

// ✅ MISE À JOUR DOSSIER (Renommer / Déplacer / Archiver)
router.patch('/chapters/:id', async (req, res) => {
    try {
        const updateData = {};
        if (req.body.title) updateData.title = req.body.title.toUpperCase().trim();
        if (req.body.section) updateData.section = req.body.section.toUpperCase().trim();
        if (req.body.isArchived !== undefined) updateData.isArchived = req.body.isArchived;
        
        const updated = await Chapter.findByIdAndUpdate(req.params.id, updateData, { new: true });
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/chapters/:id', async (req, res) => {
    try {
        await Chapter.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/sections/:teacherId', async (req, res) => {
    try {
        const { classContext } = req.query; 
        const user = await Teacher.findById(req.params.teacherId).lean() || await Admin.findById(req.params.teacherId).lean();
        if (!user || !user.subjectSections) return res.json([]);

        if (classContext) {
            const cls = await Classroom.findOne({ name: classContext }).lean();
            const currentLevel = cls?.level;

            const filtered = user.subjectSections.filter(s => {
                if (s.name === "GÉNÉRAL") return true;
                if (s.hiddenIn && s.hiddenIn.includes(classContext)) return false;
                if (s.scope === 'GLOBAL') return true;
                if (s.scope === 'LEVEL' && String(s.target) === String(currentLevel)) return true;
                if (s.scope === 'CLASS' && s.target === classContext) return true;
                return false;
            });
            return res.json(filtered);
        }
        res.json(user.subjectSections);
    } catch (e) { res.status(500).json([]); }
});

router.post('/sections', async (req, res) => {
    try {
        const { teacherId, sectionName, scope, target } = req.body;
        let user = await Teacher.findById(teacherId) || await Admin.findById(teacherId);
        if (!user) return res.status(404).send("User not found");
        if (!user.subjectSections) user.subjectSections = [];
        const name = sectionName.toUpperCase().trim();
        if (scope === 'GLOBAL') {
            user.subjectSections = user.subjectSections.filter(s => s.name !== name);
            user.subjectSections.push({ name, scope: 'GLOBAL', target: null, hiddenIn: [] });
        } 
        else if (scope === 'LEVEL') {
            if (user.subjectSections.find(s => s.name === name && s.scope === 'GLOBAL')) return res.json(user.subjectSections);
            const classesOfLevel = await Classroom.find({ level: target }).select('name');
            const classNames = classesOfLevel.map(c => c.name);
            user.subjectSections = user.subjectSections.filter(s => {
                if (s.name !== name) return true;
                if (s.scope === 'CLASS' && classNames.includes(s.target)) return false;
                if (s.scope === 'LEVEL' && s.target === target) return false;
                return true;
            });
            user.subjectSections.push({ name, scope: 'LEVEL', target, hiddenIn: [] });
        }
        else if (scope === 'CLASS') {
            const cls = await Classroom.findOne({ name: target }).lean();
            const level = cls?.level;
            const hasGlobal = user.subjectSections.find(s => s.name === name && s.scope === 'GLOBAL');
            const hasLevel = user.subjectSections.find(s => s.name === name && s.scope === 'LEVEL' && String(s.target) === String(level));
            if (hasGlobal || hasLevel) return res.json(user.subjectSections);
            const alreadyExistsForThisClass = user.subjectSections.find(s => s.name === name && s.scope === 'CLASS' && s.target === target);
            if (!alreadyExistsForThisClass) {
                user.subjectSections.push({ name, scope: 'CLASS', target, hiddenIn: [] });
            }
        }
        await user.save();
        res.json(user.subjectSections);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/sections', async (req, res) => {
    try {
        const { teacherId, sectionName, permanent, classId } = req.body;
        let user = await Teacher.findById(teacherId) || await Admin.findById(teacherId);
        if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });
        if (permanent) {
            user.subjectSections = user.subjectSections.filter(s => s.name !== sectionName);
            await Chapter.updateMany({ teacherId: user._id, section: sectionName }, { $set: { section: "GÉNÉRAL" } });
        } else {
            const section = user.subjectSections.find(s => s.name === sectionName);
            if (section) {
                if (!section.hiddenIn) section.hiddenIn = [];
                if (!section.hiddenIn.includes(classId)) section.hiddenIn.push(classId);
            }
        }
        await user.save();
        res.json(user.subjectSections);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/proxy/:id', async (req, res) => {
    try {
        const stream = await ProfDrive.getFileStream(req.params.id);
        res.setHeader('Content-Type', 'image/png');
        stream.pipe(res);
    } catch (e) { res.status(404).send("Drive Error"); }
});

module.exports = router;
