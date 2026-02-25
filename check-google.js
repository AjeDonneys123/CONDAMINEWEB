// @signatures: check
// Ce fichier sert à tester ta clé en local
require('dotenv').config();
const fetch = require('node-fetch');

async function check() {
    const key = process.env.GEMINI_API_KEY;
    console.log("🔑 Clé :", key ? "PRÉSENTE" : "MANQUANTE");
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log("📦 Réponse Google :", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("❌ Erreur :", e.message);
    }
}
check();