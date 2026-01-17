const GamesAI = require('../ai/games.ai');
const AIEngine = require('../../../core/ai.engine');

const QuizCreatorExpertAI = {
    generate: async (topic, count = 5) => {
        const prompt = `Génère un quiz de ${count} questions sur : "${topic}". 
        Format JSON: [{ "q": "...", "options": ["...", "...", "...", "..."], "a": 0 }]`;
        const raw = await GamesAI.askQuiz(prompt);
        return AIEngine.sanitizeJSON(raw);
    }
};
module.exports = QuizCreatorExpertAI;