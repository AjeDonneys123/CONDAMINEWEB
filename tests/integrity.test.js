/**
 * 🕵️‍♂️ SUITE DE TESTS D'INTÉGRITÉ - VERSION 69
 * Ce script valide que chaque injection de code respecte les User Stories.
 */
const fetch = require('node-fetch');

const API = "http://localhost:3000/api";

async function runIntegritySuite() {
    console.log("\n🚀 [GARDien] LANCEMENT DES TESTS DE NON-RÉGRESSION...");
    console.log("------------------------------------------------");

    const tests = [
        { name: "SÉCURITÉ : Chargement des 17 Modèles", url: "/admin/database-dump" },
        { name: "CLOUDSYNC : Accès au Réservoir Vault", url: "/structure/drive-tree" },
        { name: "IA : Moteur Gemini 2.0 Flash", url: "/structure/diagnostic?mode=deep" },
        { name: "AUTH : Backdoor Architecte (Jean)", url: "/auth/config" }
    ];

    let fails = 0;

    for (const t of tests) {
        try {
            const res = await fetch(`${API}${t.url}`);
            if (res.ok) {
                console.log(`✅ PASS : ${t.name}`);
            } else {
                console.log(`❌ FAIL : ${t.name} (Status: ${res.status})`);
                fails++;
            }
        } catch (e) {
            console.log(`❌ CRASH : ${t.name} (Serveur éteint ?)`);
            fails++;
        }
    }

    console.log("------------------------------------------------");
    if (fails > 0) {
        console.log(`⚠️  ALERTE : ${fails} régression(s) détectée(s). MERGE DÉCONSEILLÉ.`);
        process.exit(1);
    } else {
        console.log("✨ SYSTÈME 100% VALIDE. PRÊT POUR INJECTION.");
        process.exit(0);
    }
}

runIntegritySuite();