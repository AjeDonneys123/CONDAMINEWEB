const AIEngine = require('../../../core/ai.engine');

const QuizCreatorAI = {
    generate: async (topic, count = 5) => {
        const system = "Tu es un expert pédagogique. Tu réponds UNIQUEMENT par un tableau JSON pur. Pas de texte avant, pas de texte après.";
        
        // CORRECTION V370 : Prompt plus robuste
        const prompt = `Génère un quiz de ${count} questions sur : "${topic}".
        Chaque question doit avoir 4 options (strings).
        Le champ 'a' est l'index (0, 1, 2 ou 3) de la bonne réponse.
        
        STRUCTURE JSON OBLIGATOIRE (Array) :
        [
          {
            "q": "La question ?",
            "options": ["R1", "R2", "R3", "R4"],
            "a": 0
          }
        ]
        
        Pas de markdown (pas de \`\`\`json). Juste le tableau.`;

        const responseText = await AIEngine.ask(prompt, system);
        return AIEngine.sanitizeJSON(responseText);
    }
};

module.exports = QuizCreatorAI;