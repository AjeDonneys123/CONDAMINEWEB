const AIEngine = require('../../../core/ai.engine');

const QuizCreatorExpertAI = {
    generate: async (topic, count = 5) => {
        console.log(`🧠 [EXPERT-QUIZ] Déclenchement IA pour : ${topic}`);
        const system = "Tu es un professeur expert. Réponds UNIQUEMENT en JSON pur (Array).";
        const prompt = `Génère un tableau JSON de ${count} questions QCM sur : "${topic}". 
        Format : [{"q": "Question", "options": ["A", "B", "C", "D"], "a": 0}]`;

        try {
            const raw = await AIEngine.ask(prompt, system);
            return AIEngine.sanitizeJSON(raw);
        } catch (e) {
            console.error("❌ [EXPERT-QUIZ] Échec génération :", e.message);
            throw e;
        }
    }
};

module.exports = QuizCreatorExpertAI;
