const AIEngine = require('../../../core/ai.engine');

const ProjectDocAI = {
    generateDescriptions: async (files) => {
        if (!files || files.length === 0) return {};
        const system = "Tu es l'architecte du projet Condamine. Décris la fonction technique d'un fichier en 15 mots maximum.";
        const filesContext = files.map(f => `Fichier: ${f.name} (Chemin: ${f.path})`).join('\n');
        const prompt = `Voici des fichiers modifiés. Donne une description technique courte pour chacun au format JSON { "nom": "description" } :\n${filesContext}`;
        try {
            const response = await AIEngine.ask(prompt, system);
            return AIEngine.sanitizeJSON(response);
        } catch (e) { return {}; }
    }
};
module.exports = ProjectDocAI;