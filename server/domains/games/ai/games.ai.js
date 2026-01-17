const AIEngine = require('../../../core/ai.engine');
const GamesAI = {
    askQuiz: async (prompt) => {
        const system = "Tu es un expert en pédagogie. Réponds uniquement en JSON pur (Array).";
        return await AIEngine.ask(prompt, system);
    }
};
module.exports = GamesAI;