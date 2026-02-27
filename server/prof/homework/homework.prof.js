// @signatures: ProfHomeworkRouter, listAll, create, delete, getOne
const express = require('express');
const router = express.Router();
const { Homework, Submission, Student } = require('../models/prof.models');
const ProfDrive = require('../core/drive.prof');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const upload = multer({ dest: path.join(process.cwd(), 'public', 'uploads', 'temp') });

/**
 * 📝 BLOC DEVOIRS - ISOLÉ
 * Contient toutes les opérations CRUD pour les devoirs.
 */

router.get('/all', async (req, res) => {
    try { res.json(await Homework.find({}).sort({ date: -1 }).lean()); } 
    catch (e) { res.status(500).json({ error: "DB FAIL" }); }
});

router.get('/submissions', async (req, res) => {
    try {
        const subs = await Submission.find({}, 'studentId homeworkId grade createdAt antiCheat')
            .populate('homeworkId', 'title')
            .lean();
        res.json(subs);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/submission/:id', async (req, res) => {
    try {
        const sub = await Submission.findById(req.params.id).lean();
        if (!sub) return res.status(404).json({ error: "Copie introuvable" });
        res.json(sub);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/submission/:id', async (req, res) => {
    try {
        const updated = await Submission.findByIdAndUpdate(
            req.params.id,
            {
                feedback: req.body?.feedback,
                grade: req.body?.grade,
                content: req.body?.content
            },
            { new: true }
        ).lean();
        if (!updated) return res.status(404).json({ error: "Copie introuvable" });
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/remove-punishment', async (req, res) => {
    try {
        const { homeworkId, studentId } = req.body || {};
        await Homework.findByIdAndUpdate(homeworkId, { $pull: { assignedStudents: studentId } });
        await Student.findByIdAndUpdate(studentId, {
            $set: { punishmentStatus: 'NONE', punishmentDueDate: null }
        });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
    try {
        const hw = await Homework.findById(req.params.id).lean();
        if (!hw) return res.status(404).json({ error: "Introuvable" });
        res.json(hw);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
    try {
        const data = { ...req.body };
        if (!data._id) delete data._id;
        if (typeof data.isEnabled !== 'boolean') data.isEnabled = true;
        data.targetClassrooms = [...new Set((data.targetClassrooms || []).map(c => String(c || '').trim().toUpperCase()).filter(Boolean))];
        if (data.isPunishment) {
            data.isAllClass = false;
            data.assignedStudents = [];
        }
        
        const hw = data._id 
            ? await Homework.findByIdAndUpdate(data._id, data, { new: true })
            : await Homework.create(data);
        res.json(hw);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/enabled', async (req, res) => {
    try {
        const isEnabled = req.body?.isEnabled !== false;
        const hw = await Homework.findByIdAndUpdate(
            req.params.id,
            { $set: { isEnabled } },
            { new: true }
        ).lean();
        if (!hw) return res.status(404).json({ error: "Introuvable" });
        res.json(hw);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/upload', upload.array('files'), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "Fichier manquant" });
    }

    try {
        const folderId = await ProfDrive.getOrCreateFolder("CONDA_HOMEWORK_ASSETS");
        const urls = [];

        for (const file of req.files) {
            const driveFile = await ProfDrive.uploadFile(file.originalname, file.path, folderId);
            urls.push(`/api/structure/proxy/${driveFile.id}`);
            try { fs.unlinkSync(file.path); } catch (e) {}
        }

        res.json({ urls });
    } catch (e) {
        res.status(500).json({ error: "Erreur Drive" });
    }
});

// ✅ ROUTE DELETE RESTAURÉE
router.delete('/:id', async (req, res) => {
    try {
        await Homework.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
