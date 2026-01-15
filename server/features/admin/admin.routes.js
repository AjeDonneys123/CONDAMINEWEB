const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

/**
 * 🛠️ DOMAINE : ADMINISTRATION (DIAGNOSTIC & ÉLÈVES)
 * Cloisonnement : Ne gère aucune logique de dossier ou de Drive métier.
 */

router.get('/database-dump', async (req, res) => {
    try {
        const dump = {
            players: await mongoose.model('Player').find({}).lean(),
            teachers: await mongoose.model('Teacher').find({}).lean(),
            chapters: await mongoose.model('Chapter').find({}).lean(),
            homeworks: await mongoose.model('Homework').find({}).lean(),
            gamelevels: await mongoose.model('GameLevel').find({}).lean(),
            scansessions: await mongoose.model('ScanSession').find({}).lean(),
            bugs: await mongoose.model('Bug').find({}).lean(),
            deploysignals: await mongoose.model('DeploySignal').find({}).lean()
        };
        res.json(dump);
    } catch (e) { res.status(500).json({ error: "Dump impossible" }); }
});

router.get('/players', async (req, res) => {
    try { 
        // Utilisation de l'index défini dans le modèle
        res.json(await mongoose.model('Player').find({}).sort({ classroom: 1, lastName: 1 })); 
    } catch (e) { res.status(500).json({ error: "Erreur lecture Players" }); }
});

router.get('/drive-check', async (req, res) => {
    res.json(await DriveService.testConnection());
});

router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const { sections } = req.body;
        const updated = await mongoose.model('Teacher').findByIdAndUpdate(req.params.id, { subjectSections: sections }, { new: true });
        res.json({ user: { id: updated._id, firstName: updated.firstName, lastName: updated.lastName, subjectSections: updated.subjectSections, role: 'prof' } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;