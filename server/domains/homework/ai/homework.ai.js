const AIEngine = require('../../../core/ai.engine');
const HomeworkAI = {
    analyze: async (userText, instruction, aiHints) => {
        const system = "Tu es un professeur correcteur. Analyse la réponse selon la consigne.";
        const prompt = `Consigne: ${instruction}. Aide IA: ${aiHints}. Réponse élève: "${userText}". 
        Réponds en JSON: { "grade": "...", "feedback_fond": "..." }`;
        const res = await AIEngine.ask(prompt, system);
        return AIEngine.sanitizeJSON(res);
    }
};
module.exports = HomeworkAI;