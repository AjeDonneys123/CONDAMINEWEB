const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); 
const AuthExpert = require('./experts/auth.expert');

// 1. Configuration (Liste des classes pour le menu déroulant)
router.get('/config', async (req, res) => {
    try {
        const config = await AuthExpert.getLoginConfig();
        res.json(config);
    } catch (e) {
        res.status(500).json({ error: "BDD non initialisée" });
    }
});

// 2. DONNÉES FINDER LÉGÈRES
router.get('/finder-data', async (req, res) => {
    try {
        const list = await AuthExpert.getAllStudentsForFinder();
        res.json(list);
    } catch (e) { res.status(500).json([]); }
});

// 3. Liste des élèves d'une classe
router.get('/students/:classId', async (req, res) => {
    try {
        const list = await AuthExpert.getStudentsForSelection(req.params.classId);
        res.json(list);
    } catch (e) { res.status(500).json([]); }
});

// 4. Login Unique
router.post('/login', async (req, res) => {
    try {
        const result = await AuthExpert.verify(req.body);
        if (result.ok) res.json(result);
        else res.status(401).json(result);
    } catch (e) { res.status(500).json({ error: "Erreur technique login" }); }
});

// 5. UPDATE V3 : Récupération fraîche incluant le statut de punition
router.get('/student-fresh/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({error: "ID Invalide"});
        // AJOUT DES CHAMPS PUNITIONS DANS LA REQUÊTE
        const student = await mongoose.model('Student').findById(req.params.id, 'behaviorRecords firstName lastName punishmentStatus punishmentDueDate');
        res.json(student);
    } catch (e) { res.status(500).json({ error: "Erreur fetch student" }); }
});

module.exports = router;