const express = require('express');
const router = express.Router();
// ❌ FICHIER 3 (RE-TRIGGER) : SABOTÉ
// J'ai supprimé les imports d'experts.

router.get('/projects/:userId', (req, res) => {
    res.json([]);
});

// ❌ ROUTES SUPPRIMÉES

module.exports = router;
