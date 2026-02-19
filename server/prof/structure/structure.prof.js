// @signatures: ProfStructureRouter, chapters, sections, deleteActivityRequest, deleteChapterRequest, moveChapter, moveActivity, proxy
const express = require('express');
const router = express.Router();
const { Chapter, Teacher, Admin, Classroom, Homework, GameLevel } = require('../models/prof.models');
const ProfDrive = require('../core/drive.prof');
const mongoose = require('mongoose');

/**
 * 🛠️ BLOC STRUCTURE PROF V455 - ARCHITECT RECOVERY
 * RESTAURE : 
 * 1. Bouton X (Route /activity/delete-request)
 * 2. Création auto CH1 (Logic dans POST /sections)
 * 3. Cohérence des dossiers (Logic dans GET /chapters)
 */

const getRandomColor = () => `hsl(${Math.floor(Math.random() * 360)}, 85%, 60%)`;

// --- 1. SECTIONS (GESTION MATIÈRES) ---

router.post('/sections', async (req, res) => {
    try {
        const { teacherId, oldName, sectionName, color, scope, target } = req.body;
        const user = await Teacher.findById(teacherId) || await Admin.findById(teacherId);
        if (!user) return res.status(404).json({ error: "Prof introuvable" });

        const name = sectionName.toUpperCase().trim();
        if (name === "GÉNÉRAL") return res.json(user.subjectSections);

        if (!user.subjectSections) user.subjectSections = [];

        let isNewSection = false;

        // Cas Renommage
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
            // Cas Création
            const existingIdx = user.subjectSections.findIndex(s => s.name === name);
            if (existingIdx === -1) {
                user.subjectSections.push({ name, color: color || getRandomColor(), scope: scope || 'GLOBAL', target: target || null, hiddenIn: [] });
                isNewSection = true;
            }
        }

        await user.save();

        // 🔥 LOGIQUE CH1 AUTOMATIQUE
        if (isNewSection) {
            await Chapter.create({
                title: "CH1",
                section: name,
                teacherId: user._id,
                isArchived: false,
                classroom: scope === 'CLASS' ? target : "",
                sharedLevel: scope === 'LEVEL' ? target : ""
            });
        }

        res.json(user.subjectSections);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/sections/delete-request', async (req, res) => {
    try {
        const { teacherId, sectionName, permanent, classId } = req.body;
        const user = await Teacher.findById(teacherId) || await Admin.findById(teacherId);
        if (permanent) {
            await Chapter.updateMany({ teacherId: user._id, section: sectionName.toUpperCase() }, { $set: { section: "GÉNÉRAL" } });
            user.subjectSections = user.subjectSections.filter(s => s.name !== sectionName.toUpperCase());
        } else {
            const section = user.subjectSections.find(s => s.name === sectionName.toUpperCase());
            if (section) {
                if (!section.hiddenIn) section.hiddenIn = [];
                section.hiddenIn.push(classId);
            }
        }
        await user.save();
        res.json(user.subjectSections);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- 2. DOSSIERS (CHAPTERS) ---

router.get('/chapters', async (req, res) => {
    try {
        const { teacherId, classContext } = req.query;
        if (!teacherId || teacherId === 'undefined') return res.json([]);
        
        // Sécurité Racine
        const root = await Chapter.findOne({ teacherId, section: "GÉNÉRAL", title: "GÉNÉRAL" });
        if (!root) await Chapter.create({ title: "GÉNÉRAL", section: "GÉNÉRAL", teacherId, isArchived: false });

        const query = { teacherId };
        if (classContext) query.hiddenIn = { $ne: classContext };
        
        const chapters = await Chapter.find(query).sort({ createdAt: -1 }).lean();
        res.json(chapters.map(c => ({ ...c, _id: String(c._id) })));
    } catch (e) { res.json([]); }
});

router.post('/chapters', async (req, res) => {
    const { title, section, scope, target, teacherId } = req.body;
    const newChap = await Chapter.create({ 
        title: title.toUpperCase(), section, teacherId, 
        classroom: scope === 'CLASS' ? target : "", 
        sharedLevel: scope === 'LEVEL' ? target : "" 
    });
    res.json(newChap);
});

router.post('/chapters/delete-request', async (req, res) => {
    const { chapterId, classId, permanent } = req.body;
    if (permanent) await Chapter.findByIdAndDelete(chapterId);
    else await Chapter.findByIdAndUpdate(chapterId, { $addToSet: { hiddenIn: classId } });
    res.json({ ok: true });
});

// --- 3. ACTIVITÉS (LE BOUTON X) ---

router.post('/activity/delete-request', async (req, res) => {
    try {
        const { id, type } = req.body;
        if (type === 'homework') await Homework.findByIdAndDelete(id);
        else await GameLevel.findByIdAndDelete(id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- 4. PROXY ---
router.get('/proxy/:id', async (req, res) => {
    try {
        const stream = await ProfDrive.getFileStream(req.params.id);
        res.setHeader('Content-Type', 'image/png');
        stream.pipe(res);
    } catch (e) { res.status(404).send("Drive Error"); }
});

module.exports = router;
