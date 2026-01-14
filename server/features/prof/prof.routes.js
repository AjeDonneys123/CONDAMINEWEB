const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

const getTeacher = () => mongoose.model('Teacher');
const getPlayer = () => mongoose.model('Player');
const getChapter = () => mongoose.model('Chapter');
const getHomework = () => mongoose.model('Homework');
const getScanSession = () => mongoose.model('ScanSession');

router.get('/players', async (req, res) => {
    try {
        const data = await getPlayer().find({}).sort({ classroom: 1, lastName: 1 });
        res.json(data || []);
    } catch (e) { res.json([]); }
});

router.get('/homework-all', async (req, res) => {
    try { 
        const data = await getHomework().find({}).sort({ date: -1 });
        res.json(data || []); 
    } catch (e) { res.json([]); }
});

// US #1 : Mise à jour des sections (Super-Dossiers)
router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const updated = await getTeacher().findByIdAndUpdate(
            req.params.id, 
            { subjectSections: req.body.sections }, 
            { new: true }
        );
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// US #13 : Suppression d'une classe entière
router.delete('/classroom/:className', async (req, res) => {
    try {
        const { className } = req.params;
        console.log(`🗑️ Suppression totale de la classe : ${className}`);

        // 1. Nettoyage Drive (On tente de supprimer le dossier de la classe)
        // Note: nécessite de retrouver l'ID du dossier classe, on simplifie ici par le nettoyage BDD
        
        // 2. Suppression BDD
        await getPlayer().deleteMany({ classroom: className });
        await getChapter().deleteMany({ classroom: className });
        await getHomework().deleteMany({ classroom: className });
        await getScanSession().deleteMany({ classroom: className });

        res.json({ ok: true, message: `Classe ${className} supprimée.` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;