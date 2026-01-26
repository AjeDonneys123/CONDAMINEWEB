const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); 
const AuthExpert = require('./experts/auth.expert');
const DriveEngine = require('../../core/drive.engine'); // Import Engine pour OAuth

// 1. Configuration
router.get('/config', async (req, res) => {
    try {
        const config = await AuthExpert.getLoginConfig();
        res.json(config);
    } catch (e) { res.status(500).json({ error: "BDD non initialisée" }); }
});

// 2. DONNÉES FINDER
router.get('/finder-data', async (req, res) => {
    try {
        const list = await AuthExpert.getAllStudentsForFinder();
        res.json(list);
    } catch (e) { res.status(500).json([]); }
});

// 3. Liste élèves classe
router.get('/students/:classId', async (req, res) => {
    try {
        const list = await AuthExpert.getStudentsForSelection(req.params.classId);
        res.json(list);
    } catch (e) { res.status(500).json([]); }
});

// 4. Login
router.post('/login', async (req, res) => {
    try {
        const result = await AuthExpert.verify(req.body);
        if (result.ok) res.json(result);
        else res.status(401).json(result);
    } catch (e) { res.status(500).json({ error: "Erreur technique login" }); }
});

// 5. Student Fresh
router.get('/student-fresh/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({error: "ID Invalide"});
        const student = await mongoose.model('Student')
            .findById(req.params.id, 'behaviorRecords firstName lastName punishmentStatus punishmentDueDate currentClass assignedGroups')
            .populate('assignedGroups', 'name')
            .lean();
        res.json(student);
    } catch (e) { res.status(500).json({ error: "Erreur fetch student" }); }
});

// --- ROUTES OAUTH GOOGLE (POUR RECONNECTER LE DRIVE) ---

// A. Lancer la connexion (Redirection vers Google)
router.get('/google/login', (req, res) => {
    try {
        const url = DriveEngine.getAuthUrl();
        res.redirect(url);
    } catch (e) {
        res.status(500).send("Erreur Init OAuth: " + e.message + ". Vérifiez GOOGLE_CLIENT_ID/SECRET.");
    }
});

// B. Callback (Réception du code et affichage du Token)
router.get('/google/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send("Pas de code reçu.");

    try {
        const tokens = await DriveEngine.getTokenFromCode(code);
        const refreshToken = tokens.refresh_token;

        if (!refreshToken) {
            return res.send(`
                <h1>⚠️ Pas de Refresh Token reçu !</h1>
                <p>Google n'a renvoyé qu'un Access Token temporaire.</p>
                <p><strong>Solution :</strong> Allez sur <a href="https://myaccount.google.com/permissions">Google Permissions</a>, supprimez l'accès à "Condamine Pro" (ou votre app), et réessayez ce lien.</p>
            `);
        }

        res.send(`
            <h1 style="color:green">✅ SUCCÈS !</h1>
            <p>Voici votre nouveau <strong>GOOGLE_REFRESH_TOKEN</strong> à copier dans Render :</p>
            <textarea style="width:100%; height:100px; font-size:14px; font-family:monospace">${refreshToken}</textarea>
            <p>Une fois copié, redémarrez le serveur Render.</p>
        `);
    } catch (e) {
        res.status(500).send("Erreur Échange Token: " + e.message);
    }
});

module.exports = router;