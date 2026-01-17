



const AIEngine = require('../../../core/ai.engine');

/**
 * 🧠 DOMAINE GAMES : SPÉCIALISTE IA CRÉATEUR DE QUIZ
 */
const QuizCreatorAI = {
    generate: async (topic, count = 5) => {
        // On donne une consigne de système ultra-stricte
        const system = "Tu es un expert pédagogique. Tu réponds UNIQUEMENT par un tableau JSON pur. Pas de texte avant, pas de texte après.";
        
        const prompt = `Génère un quiz de ${count} questions sur : "${topic}".
        Chaque question doit avoir 4 options.
        Le champ 'a' est l'index (0, 1, 2 ou 3) de la bonne réponse.
        
        STRUCTURE JSON STRICTE:
        [
          {
            "q": "La question ?",
            "options": ["R1", "R2", "R3", "R4"],
            "a": 0
          }
        ]`;

        const responseText = await AIEngine.ask(prompt, system);
        return AIEngine.sanitizeJSON(responseText);
    }
};

module.exports = QuizCreatorAI;



