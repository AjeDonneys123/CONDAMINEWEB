const express = require('express');
const router = express.Router();
const AuthExpert = require('./experts/auth.expert');

// 1. Configuration (Liste des classes pour le menu déroulant) - GARDE POUR COMPATIBILITÉ
router.get('/config', async (req, res) => {
    try {
        const config = await AuthExpert.getLoginConfig();
        res.json(config);
    } catch (e) {
        res.status(500).json({ error: "BDD non initialisée" });
    }
});

// 2. DONNÉES FINDER LÉGÈRES (ID, Nom, Prénom, Classe)
router.get('/finder-data', async (req, res) => {
    try {
        const list = await AuthExpert.getAllStudentsForFinder();
        res.json(list);
    } catch (e) { res.status(500).json([]); }
});

// 3. Liste des élèves d'une classe (Legacy)
router.get('/students/:classId', async (req, res) => {
    try {
        const list = await AuthExpert.getStudentsForSelection(req.params.classId);
        res.json(list);
    } catch (e) { res.status(500).json([]); }
});

// 4. Login Unique (Prof ou Élève)
router.post('/login', async (req, res) => {
    try {
        const result = await AuthExpert.verify(req.body);
        if (result.ok) res.json(result);
        else res.status(401).json(result);
    } catch (e) { res.status(500).json({ error: "Erreur technique login" }); }
});

module.exports = router;