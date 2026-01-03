const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Nettoyage pour comparaison (accents, tirets, majuscules)
function normalize(s) {
    return (s || '').toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[-]/g, " ")
        .trim();
}

// Découpage en morceaux (ex: "Jean-Pierre" -> ["jean", "pierre"])
function getTokens(s) {
    return normalize(s).split(/\s+/).filter(t => t.length >= 2);
}

router.post('/register', async (req, res) => {
    const { firstName, lastName, classroom, password } = req.body;
    const Player = mongoose.model('Player');

    console.log(`🔑 [AUTH] Tentative : ${firstName} ${lastName} (${classroom})`);

    // 1. CAS PROF
    if (normalize(firstName) === "jean" && normalize(lastName) === "vuillet") {
        if (password === "Clemenceau1919") {
            return res.json({ ok: true, id: "prof", firstName: "Jean", lastName: "Vuillet", classroom: "Professeur" });
        }
        return res.status(401).json({ ok: false, message: "Mot de passe Maître incorrect" });
    }

    // 2. RECHERCHE ÉLÈVE ULTRA-TOLÉRANTE
    try {
        const inputFirsts = getTokens(firstName);
        const inputLasts = getTokens(lastName);
        const inputClass = normalize(classroom);

        const allStudents = await Player.find({});
        
        const match = allStudents.find(p => {
            // Match classe (tolère 6D vs 6eD)
            const dbClass = normalize(p.classroom);
            const classMatch = dbClass.includes(inputClass) || inputClass.includes(dbClass);
            
            const dbFirsts = getTokens(p.firstName);
            const dbLasts = getTokens(p.lastName);

            // Match si au moins un token du prénom ET un token du nom correspondent
            const fNameMatch = inputFirsts.some(t => dbFirsts.includes(t)) || dbFirsts.some(t => inputFirsts.includes(t));
            const lNameMatch = inputLasts.some(t => dbLasts.includes(t)) || dbLasts.some(t => inputLasts.includes(t));

            return classMatch && fNameMatch && lNameMatch;
        });

        if (match) {
            console.log(`✅ [AUTH] Succès pour : ${match.firstName}`);
            return res.json({ ok: true, id: match._id, firstName: match.firstName, lastName: match.lastName, classroom: match.classroom });
        }

        res.status(404).json({ ok: false, message: "Élève non reconnu. Vérifie l'orthographe ou la classe." });

    } catch (e) {
        res.status(500).json({ ok: false, message: "Erreur technique" });
    }
});

module.exports = router;