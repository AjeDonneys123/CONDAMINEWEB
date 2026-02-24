// @signatures: ProfHomeworkRouter, listAll, create, delete, getOne
const express = require('express');
const router = express.Router();
const { Homework } = require('../models/prof.models');

/**
 * 📝 BLOC DEVOIRS - ISOLÉ
 * Contient toutes les opérations CRUD pour les devoirs.
 */

router.get('/all', async (req, res) => {
    try { res.json(await Homework.find({}).sort({ date: -1 }).lean()); } 
    catch (e) { res.status(500).json({ error: "DB FAIL" }); }
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

// ✅ ROUTE DELETE RESTAURÉE
router.delete('/:id', async (req, res) => {
    try {
        await Homework.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
