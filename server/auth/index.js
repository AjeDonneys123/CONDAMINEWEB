const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

function normalize(s) {
    return (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-]/g, " ").trim();
}

function getTokens(s) {
    return normalize(s).split(/\s+/).filter(t => t.length >= 2);
}

router.post('/register', async (req, res) => {
    const { firstName, lastName, classroom, password } = req.body;
    const Player = mongoose.model('Player');
    
    // CAS PROF
    if (normalize(firstName) === "jean" && normalize(lastName) === "vuillet" && password === "Clemenceau1919") {
        return res.json({ ok: true, id: "prof", firstName: "Jean", lastName: "Vuillet", classroom: "Professeur" });
    }

    // CAS ÉLÈVE
    try {
        const inputFirsts = getTokens(firstName);
        const inputLasts = getTokens(lastName);
        const inputClass = normalize(classroom);
        const allStudents = await Player.find({});
        
        const match = allStudents.find(p => {
            const dbClass = normalize(p.classroom);
            const classMatch = dbClass.includes(inputClass) || inputClass.includes(dbClass);
            const dbFirsts = getTokens(p.firstName);
            const dbLasts = getTokens(p.lastName);
            return classMatch && 
                   (inputFirsts.some(t => dbFirsts.includes(t)) || dbFirsts.some(t => inputFirsts.includes(t))) && 
                   (inputLasts.some(t => dbLasts.includes(t)) || dbLasts.some(t => inputLasts.includes(t)));
        });

        if (match) return res.json({ ok: true, id: match._id, firstName: match.firstName, lastName: match.lastName, classroom: match.classroom });
        
        // Création auto élève test
        if (firstName === "Eleve" && lastName === "Test") {
             let testP = await Player.findOne({ firstName: "Eleve", lastName: "Test", classroom });
             if (!testP) testP = await new Player({ firstName: "Eleve", lastName: "Test", classroom }).save();
             return res.json({ ok: true, id: testP._id, firstName: "Eleve", lastName: "Test", classroom });
        }

        res.status(404).json({ ok: false, message: "Élève inconnu" });
    } catch (e) { res.status(500).json({ ok: false }); }
});

module.exports = router;