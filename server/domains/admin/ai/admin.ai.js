const AIEngine = require('../../../core/ai.engine');

const AdminAI = {
    // ANALYSE ÉLÈVES
    extractStudentsFromInput: async (dataPayload) => {
        const system = "Tu es un expert Data Scientist scolaire. Structure ces données en JSON.";
        let prompt = ["ANALYSE CES DONNÉES SCOLAIRES (Liste Excel/CSV).", "FORMAT ATTENDU:",
        `[{"firstName":"Jean","lastName":"DUPONT","email":"jean@ecole.com","gender":"M"}]`];
        if (dataPayload.text) prompt.push(`DONNÉES: ${dataPayload.text}`);
        if (dataPayload.image) {
            prompt.push({ inlineData: { data: dataPayload.image.split(',')[1], mimeType: "image/jpeg" }});
            prompt.push("Capture Excel. Sépare bien Email et autres colonnes.");
        }
        const raw = await AIEngine.ask(prompt, system);
        return AIEngine.sanitizeJSON(raw);
    },

    // ANALYSE CLASSES (NOUVEAU)
    extractClassesFromInput: async (dataPayload) => {
        const system = "Tu es un assistant administratif scolaire. Tu dois lister les classes détectées.";
        const prompt = [
            "Analyse ce texte et extrais la liste des classes.",
            "Normalise les noms : '6ème A' -> '6A', 'Seconde 1' -> '2DE1', '5 B' -> '5B'.",
            "Détecte si c'est une classe standard (TYPE='CLASS') ou un groupe de spécialité (TYPE='GROUP' - ex: 'Anglais', 'Latin').",
            "FORMAT JSON :",
            `[{"name": "6A", "type": "CLASS"}, {"name": "LATIN_5E", "type": "GROUP"}]`,
            `DONNÉES À TRAITER : ${dataPayload.text}`
        ];
        const raw = await AIEngine.ask(prompt, system);
        return AIEngine.sanitizeJSON(raw);
    }
};

module.exports = AdminAI;