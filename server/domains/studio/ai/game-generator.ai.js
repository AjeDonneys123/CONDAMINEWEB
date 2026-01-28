const AIEngine = require('../../../core/ai.engine');

const GameGeneratorAI = {
    
    generateGameCode: async (gameIdea, actors) => {
        console.log("🕹️ [GAME-GEN] Nouvelle Création...");

        const actorsContext = actors.map((a) => {
            return `- ID: "${a.id}", Nom: "${a.name}"`;
        }).join('\n');

        const system = `Tu es un développeur de jeux expert. Tu écris du code HTML5 Canvas JavaScript.
        
        RÈGLES TECHNIQUES :
        1. Tu dois créer une classe 'MiniGame'.
        2. Les images sont déjà chargées dans 'this.assets[ID_ACTEUR]'.
        3. 'this.canvas' est disponible dans la classe.
        4. Méthodes obligatoires : start(), destroy(), et une boucle d'update via requestAnimationFrame.
        5. L'axe Y est inversé (0 en haut).
        6. Pour un Mario-like : Gère la gravité, les collisions avec les bords et les ennemis.

        RÈGLES DE DIALOGUE :
        Dans ton champ 'message', explique tes choix de gameplay et comment tester.`;

        const prompt = `CRÉATION DE JEU : "${gameIdea}"
        
        ACTEURS DISPONIBLES :
        ${actorsContext}

        RENVOIE UN JSON : { "code": "...", "message": "..." }`;

        try {
            const raw = await AIEngine.ask(prompt, system);
            return AIEngine.sanitizeJSON(raw);
        } catch (e) { throw e; }
    },

    fixGameCode: async (currentCode, userInstruction, actors) => {
        console.log("🔧 [GAME-FIX] Modification en cours...");

        const actorsContext = actors.map((a) => `- ID: "${a.id}", Nom: "${a.name}"`).join('\n');

        const system = `Tu es un développeur de jeux expert. Modifie le code existant.
        
        RÈGLES :
        1. Garde la structure de la classe 'MiniGame'.
        2. Utilise les IDs d'acteurs pour les images.
        3. Dans 'message', liste exactement ce que tu as mis à jour.`;

        const prompt = `CODE ACTUEL :
        ${currentCode}

        DEMANDE DE MISE À JOUR :
        "${userInstruction}"

        ACTEURS :
        ${actorsContext}

        RENVOIE UN JSON : { "code": "...", "message": "..." }`;

        try {
            const raw = await AIEngine.ask(prompt, system);
            return AIEngine.sanitizeJSON(raw);
        } catch (e) { throw e; }
    }
};

module.exports = GameGeneratorAI;
