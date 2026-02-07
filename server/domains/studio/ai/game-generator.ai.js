// @signatures: MiniGame
const AIEngine = require('../../../core/ai.engine');

const GameGeneratorAI = {
    
    generateGameCode: async (gameIdea, actors) => {
        console.log("🕹️ [GAME-GEN] Création Native V420...");

        const actorsContext = actors.map((a) => `- ID: "${a.id}", Nom: "${a.name}"`).join('\n');

        const system = `Tu es un développeur de jeux expert pour le moteur Condamine Engine V4.
        
        CONTRAT TECHNIQUE STRICT (ARCHITECTURE V420) :
        1. Ta classe DOIT étendre 'MiniGameBase'.
        2. Le constructeur DOIT appeler 'super(canvas, assets, callbacks)'.
        3. NE JAMAIS ÉCRIRE DE MÉTHODE 'loop()'. C'est le moteur qui gère la boucle.
        4. NE JAMAIS UTILISER 'requestAnimationFrame'.
        5. Utilise 'update()' pour la logique (mouvements, collisions).
        6. Utilise 'draw()' UNIQUEMENT pour le HUD (Score, Vies). NE DESSINE PAS LES ACTEURS (C'est automatique).
        7. Les acteurs sont disponibles directement via 'this.NOM_ACTEUR' (ex: this.HEROS, this.ZOMBIE).
        
        STRUCTURE OBLIGATOIRE :
        class MiniGame extends MiniGameBase {
            constructor(canvas, assets, callbacks) {
                super(canvas, assets, callbacks);
                this.score = 0;
            }
            start() { 
                // Initialisation (positions, écouteurs clavier)
                // this.keys est déjà géré par le parent
            }
            update() { 
                // Logique par frame (ex: this.HEROS.x += 1)
            }
            draw() { 
                // HUD uniquement (ex: this.ctx.fillText("Score", 10, 10))
            }
            onQuestion(q) { /* Réception question */ }
            onResult(correct) { /* Réception résultat */ }
        }

        Réponds UNIQUEMENT un objet JSON : { "code": "...", "message": "..." }.`;

        const prompt = `GÉNÈRE LE JEU : "${gameIdea}"\nACTEURS DISPONIBLES :\n${actorsContext}`;

        try {
            const raw = await AIEngine.ask(prompt, system);
            return AIEngine.sanitizeJSON(raw);
        } catch (e) { throw e; }
    },

    fixGameCode: async (currentCode, userInstruction, actors) => {
        console.log("🔧 [GAME-FIX] Correction V420...");

        const actorsContext = actors.map((a) => `- ID: "${a.id}", Nom: "${a.name}"`).join('\n');

        const system = `Tu es un expert du moteur Condamine V4. Corrige le script.
        
        RÈGLES CRITIQUES :
        - Vérifie que la classe étend bien 'MiniGameBase'.
        - Vérifie que 'super()' est appelé dans le constructeur.
        - Supprime toute méthode 'loop()' ou appel à 'requestAnimationFrame'.
        - Déplace la logique de mouvement dans 'update()'.
        - Déplace le dessin du HUD dans 'draw()'.
        - Ne dessine jamais les acteurs manuellement (drawImage), le moteur le fait.

        Réponds en JSON : { "code": "...", "message": "Explication courte" }.`;

        const prompt = `CODE ACTUEL :\n${currentCode}\n\nPROBLÈME : "${userInstruction}"\nACTEURS : ${actorsContext}`;

        try {
            const raw = await AIEngine.ask(prompt, system);
            return AIEngine.sanitizeJSON(raw);
        } catch (e) { throw e; }
    }
};

module.exports = GameGeneratorAI;
