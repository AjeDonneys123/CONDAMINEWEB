// @signatures: ProfHomeworkRouter, listAll, create, update, delete, getOne
const express = require('express');
const router = express.Router();
const { Homework } = require('../models/prof.models');

/**
 * 📝 BLOC DEVOIRS PROF - API RESTAURÉE
 * Inclut Create, Read, Update, Delete pour éviter les 404.
 */

// 1. LISTE
router.get('/all', async (req, res) => {
    try {
        const list = await Homework.find({}).sort({ date: -1 }).lean();
        res.json(list);
    } catch (e) { res.status(500).json({ error: "DB FAIL" }); }
});

// 2. DÉTAIL (Pour édition)
router.get('/:id', async (req, res) => {
    try {
        const hw = await Homework.findById(req.params.id).lean();
        if (!hw) return res.status(404).json({ error: "Introuvable" });
        res.json(hw);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. CRÉATION / MISE À JOUR (Upsert)
router.post('/', async (req, res) => {
    try {
        const data = req.body;
        // Nettoyage ID si vide
        if (data._id === "" || data._id === "null" || !data._id) delete data._id;
        
        let hw;
        if (data._id) {
            hw = await Homework.findByIdAndUpdate(data._id, data, { new: true });
        } else {
            hw = await Homework.create(data);
        }
        res.json(hw);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 4. SUPPRESSION (La route qui manquait)
router.delete('/:id', async (req, res) => {
    try {
        await Homework.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
