




const AIEngine = require('../../../core/ai.engine');

const HomeworkAI = {
    analyze: async (userText, instruction, aiHints) => {
        const system = "Tu es un professeur correcteur. Analyse la réponse de l'élève par rapport à la consigne.";
        const prompt = `Consigne: ${instruction}. Aide IA: ${aiHints}. Réponse élève: "${userText}". Réponds en JSON: { "grade": "A/B/C", "feedback_fond": "...", "mistakes": [] }`;
        const res = await AIEngine.ask(prompt, system);
        return AIEngine.sanitizeJSON(res);
    }
};

module.exports = HomeworkAI;




