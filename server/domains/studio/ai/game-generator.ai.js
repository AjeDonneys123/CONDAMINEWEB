// @signatures: MiniGameGeneratorAI
const AIEngine = require('../../../core/ai.engine');

/**
 * 🕹️ GAME GENERATOR AI V425
 * REPAIRS:
 * - Force l'utilisation des alias Actor Proxy.
 * - Explique explicitement comment appeler le Bridge.
 */
const GameGeneratorAI = {
    
    generateGameCode: async (gameIdea, actors) => {
        console.log("🕹️ [GAME-GEN] Création Native V425...");

        const actorsContext = actors.map((a, i) => {
            const safeName = a.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
            return `- Alias code: "this.${safeName}" (Sprite: "${a.name}")`;
        }).join('\n');

        const system = `Tu es un développeur de jeux expert pour le moteur Condamine Engine V4.
        
        CONTRAT TECHNIQUE (V425) :
        1. Ta classe DOIT étendre 'MiniGameBase'.
        2. Le constructeur DOIT appeler 'super(canvas, assets, callbacks)'.
        3. Logic dans 'update()', HUD dans 'draw()'. Pas de loop() manuelle.
        4. BRIDGE ÉVÉNEMENTS : 
           - this.game.damage(1) : Enlève une vie et fait vibrer l'écran.
           - this.game.shake() : Secoue l'écran.
           - this.game.submitAnswer(index) : Soumet la réponse de l'UI vers le moteur.
           - this.game.winRound() : Valide la question en cours.
           - this.game.nextQuestion() : Passe à la question suivante.
        
        ACTEURS DISPONIBLES :
        ${actorsContext}

        Réponds UNIQUEMENT un objet JSON : { "code": "...", "message": "..." }.`;

        const prompt = `GÉNÈRE LE JEU : "${gameIdea}"`;

        try {
            const raw = await AIEngine.ask(prompt, system);
            return AIEngine.sanitizeJSON(raw);
        } catch (e) { throw e; }
    }
};

module.exports = GameGeneratorAI;