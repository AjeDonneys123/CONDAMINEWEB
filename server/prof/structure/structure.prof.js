// @signatures: ProfStructureRouter, chapters, sections, deleteActivityRequest, deleteChapterRequest, moveChapter, moveActivity, proxy
const express = require('express');
const router = express.Router();
const { Chapter, Teacher, Admin, Classroom, Homework, GameLevel, ScanSession } = require('../models/prof.models');
const mongoose = require('mongoose');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// --- SECTIONS ---
router.get('/sections/:teacherId', asyncHandler(async (req, res) => {
    const { teacherId } = req.params;
    const { classContext } = req.query;

    if (!teacherId || teacherId === 'undefined' || !mongoose.Types.ObjectId.isValid(teacherId)) {
        return res.json([{ name: 'GÉNÉRAL', color: '#64748b', scope: 'GLOBAL' }]);
    }

    const user = await Teacher.findById(teacherId).lean() || await Admin.findById(teacherId).lean();
    if (!user) return res.status(404).json({ error: "User not found" });

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
}));

// --- CHAPITRES ---
router.get('/chapters', asyncHandler(async (req, res) => {
    const { teacherId } = req.query;
    if (!teacherId || !mongoose.Types.ObjectId.isValid(teacherId)) return res.json([]);

    const chapters = await Chapter.find({ teacherId }).sort({ title: 1 }).lean();
    res.json(chapters);
}));

router.post('/chapters', asyncHandler(async (req, res) => {
    const { title, section, scope, target, teacherId } = req.body;
    const newChap = await Chapter.create({ 
        title: (title || "NOUVEAU").toUpperCase(), 
        section: (section || "GÉNÉRAL").toUpperCase(), 
        classroom: scope === 'CLASS' ? target : "", 
        sharedLevel: scope === 'LEVEL' ? target : "", 
        teacherId 
    });
    res.json(newChap);
}));

module.exports = router;
