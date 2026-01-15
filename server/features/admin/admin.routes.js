const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

/**
 * 🛠️ DOMAINE : ADMINISTRATION (DIAGNOSTIC TOTAL)
 */

// US #15 : Diagnostic BDD aligné sur les collections RÉELLES
router.get('/database-dump', async (req, res) => {
    try {
        // On interroge les modèles en utilisant leurs noms exacts pour coller à la réalité MongoDB
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
    } catch (e) {
        console.error("❌ Erreur Dump BDD:", e.message);
        res.status(500).json({ error: "Impossible de dumper la base" });
    }
});

router.get('/players', async (req, res) => {
    try { res.json(await mongoose.model('Player').find({}).sort({ classroom: 1, lastName: 1 })); } 
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/drive-check', async (req, res) => {
    const status = await DriveService.testConnection();
    res.json(status);
});

router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const { sections } = req.body;
        const updated = await mongoose.model('Teacher').findByIdAndUpdate(req.params.id, { subjectSections: sections }, { new: true });
        res.json({ user: { id: updated._id, firstName: updated.firstName, lastName: updated.lastName, subjectSections: updated.subjectSections, role: 'prof' } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;