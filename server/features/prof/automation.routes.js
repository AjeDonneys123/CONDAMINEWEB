const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const getChapter = () => mongoose.model('Chapter');
const getScanSession = () => mongoose.model('ScanSession');

// --- ROUTES CHAPITRES (DOSSIERS) ---

router.get('/chapters-all', async (req, res) => {
    try {
        const Chapter = getChapter();
        const data = await Chapter.find({}).sort({ _id: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

router.post('/chapters', async (req, res) => {
    try {
        const Chapter = getChapter();
        const { _id, title, classroom, subject, teacherId, isArchived } = req.body;

        // Mise à jour existant
        if (_id) {
            const updateData = { ...req.body };
            delete updateData._id;
            const updated = await Chapter.findByIdAndUpdate(_id, updateData, { new: true });
            return res.json(updated);
        }

        // Création nouveau
        const newChap = await Chapter.create({ 
            title: title || "Nouveau Dossier", 
            classroom, 
            subject, 
            teacherId, 
            isArchived: false 
        });
        res.json(newChap);
    } catch (e) { 
        console.error("Erreur création chapitre:", e.message);
        res.status(500).json({ error: e.message }); 
    }
});

router.delete('/chapters/:id', async (req, res) => {
    try {
        await getChapter().findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ROUTES SCANS ---

router.get('/scan-sessions', async (req, res) => {
    try {
        const data = await getScanSession().find({}).sort({ createdAt: -1 });
        res.json(data || []);
    } catch (e) { res.status(500).json([]); }
});

router.post('/scan-sessions', async (req, res) => {
    try {
        const session = await getScanSession().create(req.body);
        res.json(session);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/scan-sessions/:id/assign-chapter', async (req, res) => {
    try {
        const updated = await getScanSession().findByIdAndUpdate(req.params.id, { chapterId: req.body.chapterId }, { new: true });
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;