const AIEngine = require('../../../core/ai.engine');

const GameGeneratorAI = {
    
    generateGameCode: async (gameIdea, actors) => {
        console.log("🕹️ [GAME-GEN] Nouvelle Création...");

        const actorsContext = actors.map((a) => `- ID: "${a.id}", Nom: "${a.name}"`).join('\n');

        const system = `Tu es un développeur de jeux expert en JavaScript HTML5 Canvas.
        
        CONTRAT TECHNIQUE OBLIGATOIRE :
        1. Crée une classe nommée 'MiniGame'.
        2. Le constructeur doit être : constructor(canvas, assets) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.assets = assets; }
        3. Méthodes requises : start() { ... }, update() { ... }, draw() { ... }, destroy() { ... }.
        4. Loop : Utilise requestAnimationFrame dans update().
        5. Assets : Pour dessiner un acteur, utilise this.assets['ID_DE_L_ACTEUR'].
        6. Input : Gère this.keys = {} pour le clavier.
        7. VISUELS : Si un acteur est une plateforme ou n'a pas d'image, dessine des blocs de couleur (ctx.fillRect) pour éviter un écran vide.

        RÈGLES DE JEU (Mario-like) :
        - Gravité : y += velocityY.
        - Collision Plateforme : Empêche de tomber.
        - Scrolling : Simule une progression vers la droite.

        RÉPONDS UNIQUEMENT EN JSON : { "code": "Le code JS complet", "message": "Résumé des fonctionnalités" }`;

        const prompt = `CRÉE LE JEU : "${gameIdea}"\nACTEURS : ${actorsContext}`;

        try {
            const raw = await AIEngine.ask(prompt, system);
            return AIEngine.sanitizeJSON(raw);
        } catch (e) { throw e; }
    },

    fixGameCode: async (currentCode, userInstruction, actors) => {
        console.log("🔧 [GAME-FIX] Modification...");

        const actorsContext = actors.map((a) => `- ID: "${a.id}", Nom: "${a.name}"`).join('\n');

        const system = `Tu es un expert JS Canvas. Modifie la classe MiniGame existante selon les instructions.
        Respecte scrupuleusement le constructeur(canvas, assets).
        Liste les changements dans le champ 'message'.
        RÉPONDS UNIQUEMENT EN JSON.`;

        const prompt = `CODE ACTUEL :\n${currentCode}\n\nMODIFICATION DEMANDÉE : "${userInstruction}"\nACTEURS : ${actorsContext}`;

        try {
            const raw = await AIEngine.ask(prompt, system);
            return AIEngine.sanitizeJSON(raw);
        } catch (e) { throw e; }
    }
};

module.exports = GameGeneratorAI;
