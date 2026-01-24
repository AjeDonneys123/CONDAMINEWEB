const AIEngine = require('../../../core/ai.engine');
const fs = require('fs');
const path = require('path');

/**
 * 🧠 EXPERT IA DEVOIRS - VERSION 219 (MULTIMODAL)
 */
const HomeworkAI = {
    // Analyse classique d'une réponse texte
    analyze: async (userText, instruction, aiHints) => {
        const system = "Tu es un professeur correcteur. Analyse la réponse de l'élève par rapport à la consigne.";
        const prompt = `Consigne: ${instruction}. Aide IA: ${aiHints}. Réponse élève: "${userText}". Réponds en JSON: { "grade": "A/B/C", "feedback_fond": "...", "mistakes": [] }`;
        const res = await AIEngine.ask(prompt, system);
        return AIEngine.sanitizeJSON(res);
    },

    /**
     * 📸 GÉNÉRATION DE GRILLE DE CORRECTION (MULTIMODAL)
     * Lit les fichiers images sur le disque et les envoie à Gemini.
     */
    generateHintsFromAssets: async (instruction, imageUrls) => {
        console.log("🧠 [AI-HINTS] Analyse multimodal des documents...");
        
        const system = "Tu es un expert pédagogique. Ta mission est de rédiger une GRILLE DE CORRECTION précise (points clés, dates, chiffres attendus) basée sur les documents fournis pour que l'IA puisse corriger l'élève plus tard.";
        
        const promptParts = [
            { text: `CONSIGNE DU PROFESSEUR : ${instruction || "Non précisée"}\n\nMISSION : Analyse les images jointes et rédige une grille de correction structurée (points de vigilance, éléments de réponse) pour l'IA.` }
        ];

        // Intégration des images dans le prompt
        imageUrls.forEach(url => {
            const fileName = url.split('/').pop();
            const filePath = path.join(process.cwd(), 'public', 'uploads', fileName);
            
            if (fs.existsSync(filePath)) {
                const buffer = fs.readFileSync(filePath);
                promptParts.push({
                    inlineData: {
                        mimeType: "image/png",
                        data: buffer.toString('base64')
                    }
                });
            }
        });

        try {
            const response = await AIEngine.ask(promptParts, system);
            return response; // Texte brut pour le textarea
        } catch (e) {
            console.error("❌ [AI-HINTS] Erreur:", e.message);
            throw new Error("L'IA n'a pas pu analyser les images.");
        }
    }
};

module.exports = HomeworkAI;