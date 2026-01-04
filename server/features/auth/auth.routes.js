const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Fonction de nettoyage
function normalize(s) {
    return (s || '').toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[-]/g, " ")
        .trim();
}

function getTokens(s) {
    return normalize(s).split(/\s+/).filter(t => t.length >= 2);
}

router.post('/register', async (req, res) => {
    try {
        console.log("🔑 [LOGIN] Tentative de connexion reçue...");
        
        const { firstName, lastName, classroom, password } = req.body;
        const Player = mongoose.model('Player');

        // 1. PROFESSEUR
        if (normalize(firstName) === "jean" && normalize(lastName) === "vuillet") {
            if (password === "Clemenceau1919") {
                console.log("✅ [LOGIN] Professeur identifié.");
                return res.json({ ok: true, id: "prof", firstName: "Jean", lastName: "Vuillet", classroom: "Professeur" });
            }
            return res.status(401).json({ ok: false, message: "Mot de passe incorrect." });
        }

        // 2. ÉLÈVE
        const inputFirsts = getTokens(firstName);
        const inputLasts = getTokens(lastName);
        const inputClass = normalize(classroom);

        const allStudents = await Player.find({});
        
        const match = allStudents.find(p => {
            const dbClass = normalize(p.classroom);
            // Tolérance 5B == 5eB
            const classMatch = dbClass.replace('e', '') === inputClass.replace('e', ''); 
            
            const dbFirsts = getTokens(p.firstName);
            const dbLasts = getTokens(p.lastName);

            const fNameMatch = inputFirsts.some(t => dbFirsts.includes(t)) || dbFirsts.some(t => inputFirsts.includes(t));
            const lNameMatch = inputLasts.some(t => dbLasts.includes(t)) || dbLasts.some(t => inputLasts.includes(t));

            return classMatch && fNameMatch && lNameMatch;
        });

        if (match) {
            console.log(`✅ [LOGIN] Élève trouvé : ${match.firstName} ${match.lastName}`);
            return res.json({ ok: true, id: match._id, firstName: match.firstName, lastName: match.lastName, classroom: match.classroom });
        }

        console.log("❌ [LOGIN] Échec : Élève introuvable.");
        res.status(404).json({ ok: false, message: "Élève inconnu." });

    } catch (e) {
        console.error("❌ [LOGIN] Erreur serveur :", e);
        res.status(500).json({ ok: false, message: "Erreur serveur." });
    }
});

module.exports = router;