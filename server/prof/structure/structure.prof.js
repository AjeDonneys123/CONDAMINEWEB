// @signatures: ProfStructureRouter, chapters, sections, deleteActivityRequest, deleteChapterRequest, moveChapter, moveActivity, proxy
const express = require('express');
const router = express.Router();
const { Chapter, Teacher, Admin, Classroom, Homework, GameLevel, ScanSession } = require('../models/prof.models');
const ProfDrive = require('../core/drive.prof');
const mongoose = require('mongoose');

/**
 * 🛠️ BLOC STRUCTURE PROF - FIX DELETE & LOGIC
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

        // A. RENOMMAGE
        if (oldName && oldName.toUpperCase() !== name) {
            const idx = user.subjectSections.findIndex(s => s.name === oldName.toUpperCase());
            if (idx !== -1) {
                user.subjectSections[idx].name = name;
                if (color) user.subjectSections[idx].color = color;
                if (scope) user.subjectSections[idx].scope = scope;
                if (target) user.subjectSections[idx].target = target;
                
                await Chapter.updateMany(
                    { teacherId: user._id, section: oldName.toUpperCase() }, 
                    { $set: { section: name } }
                );
            }
            await user.save();
        } 
        // B. CRÉATION
        else {
            const existingIdx = user.subjectSections.findIndex(s => s.name === name);
            if (existingIdx !== -1) {
                if (color) user.subjectSections[existingIdx].color = color;
                if (scope) user.subjectSections[existingIdx].scope = scope;
                if (target) user.subjectSections[existingIdx].target = target;
                await user.save();
            } else {
                // INSERTION BDD via $push pour éviter les conflits de version
                await (user.constructor).findByIdAndUpdate(user._id, {
                    $push: { 
                        subjectSections: { 
                            name, 
                            color: color || getRandomColor(), 
                            scope: scope || 'GLOBAL', 
                            target: target || null, 
                            hiddenIn: [] 
                        } 
                    }
                });

                // AUTO-CREATION CH1
                // Logique : Si section GLOBAL -> CH1 est GLOBAL (donc visible par tous les niveaux, agissant comme un commun)
                // Si section CLASSE -> CH1 est CLASSE
                await Chapter.create({
                    title: "CH1",
                    section: name,
                    teacherId: user._id,
                    classroom: scope === 'CLASS' ? target : "",
                    sharedLevel: scope === 'LEVEL' ? target : "",
                    isArchived: false
                });
            }
        }
        
        // Re-fetch pour renvoyer la donnée fraîche
        const updatedUser = await (user.constructor).findById(user._id).lean();
        res.json(updatedUser.subjectSections);

    } catch (e) { 
        console.error("Section Error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

router.post('/sections/delete-request', async (req, res) => {
    try {
        const { teacherId, sectionName, permanent, classId } = req.body;
        const userModel = await Teacher.exists({ _id: teacherId }) ? Teacher : Admin;
        const name = sectionName.toUpperCase().trim();

        if (permanent) {
            // 1. Migrer le contenu vers GÉNÉRAL
            await Chapter.updateMany(
                { teacherId, section: name }, 
                { $set: { section: "GÉNÉRAL" } }
            );
            
            // 2. Supprimer la section via $pull (Correction du crash 500)
            await userModel.findByIdAndUpdate(teacherId, {
                $pull: { subjectSections: { name: name } }
            });
        } else {
            // Masquage local
            // On doit charger, modifier, sauver pour gérer le tableau hiddenIn dans le sous-document
            const user = await userModel.findById(teacherId);
            const section = user.subjectSections.find(s => s.name === name);
            if (section) {
                if (!section.hiddenIn) section.hiddenIn = [];
                if (!section.hiddenIn.includes(classId)) section.hiddenIn.push(classId);
                await user.save();
            }
        }

        const updatedUser = await userModel.findById(teacherId).lean();
        res.json(updatedUser.subjectSections);
    } catch (e) {
        console.error("Delete Section Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- 2. CHAPITRES ---

router.get('/chapters', async (req, res) => {
    try {
        const { teacherId, classContext } = req.query;
        const isValidId = teacherId && teacherId !== 'undefined' && mongoose.Types.ObjectId.isValid(teacherId);
        
        if (isValidId) {
            const root = await Chapter.findOne({ teacherId, section: "GÉNÉRAL", title: "GÉNÉRAL" });
            if (!root) await Chapter.create({ title: "GÉNÉRAL", section: "GÉNÉRAL", teacherId, isArchived: false });
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
