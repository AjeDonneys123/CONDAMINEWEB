// @signatures: MiniGame
const AIEngine = require('../../../core/ai.engine');

const GameGeneratorAI = {
    
    generateGameCode: async (gameIdea, actors) => {
        console.log("🕹️ [GAME-GEN] Création forcée...");

        const actorsContext = actors.map((a) => `- ID: "${a.id}", Nom: "${a.name}"`).join('\n');

        const system = `Tu es un développeur de jeux expert. Tu écris UNIQUEMENT une classe JavaScript nommée 'MiniGame'.
        
        CONTRAT TECHNIQUE INVIOLABLE :
        1. Tu dois retourner un objet JSON : { "code": "...", "message": "..." }.
        2. Le code DOIT contenir 'class MiniGame { ... }'.
        3. Le constructeur DOIT être : 'constructor(canvas, assets) { ... }'.
        4. La méthode 'start()' est OBLIGATORY. Elle lance la boucle de jeu.
        5. La méthode 'destroy()' est OBLIGATORY. Elle nettoie les events et arrête le loop.
        6. Utilise 'this.assets[ID_ACTEUR]' pour dessiner les personnages.
        
        INTERDICTION :
        - Ne dis jamais que l'erreur ne vient pas de toi.
        - Si une méthode manque, RE-GÉNÈRE LA CLASSE COMPLÈTE avec la méthode manquante.
        - Ne réponds jamais en anglais.

        STRUCTURE REQUISE :
        class MiniGame {
            constructor(canvas, assets) {
                this.canvas = canvas;
                this.ctx = canvas.getContext('2d');
                this.assets = assets;
                this.keys = {};
                this.running = false;
            }
            start() { 
                this.running = true;
                window.addEventListener('keydown', e => this.keys[e.code] = true);
                window.addEventListener('keyup', e => this.keys[e.code] = false);
                this.loop();
            }
            loop() {
                if(!this.running) return;
                this.update();
                this.draw();
                requestAnimationFrame(() => this.loop());
            }
            update() { /* Logique de saut, gravité, collisions */ }
            draw() { /* Effacer le canvas et dessiner this.assets */ }
            destroy() { this.running = false; }
        }`;

        const prompt = `GÉNÈRE LE JEU : "${gameIdea}"\nACTEURS : ${actorsContext}`;

        try {
            const raw = await AIEngine.ask(prompt, system);
            return AIEngine.sanitizeJSON(raw);
        } catch (e) { throw e; }
    },

    fixGameCode: async (currentCode, userInstruction, actors) => {
        console.log("🔧 [GAME-FIX] Correction forcée...");

        const actorsContext = actors.map((a) => `- ID: "${a.id}", Nom: "${a.name}"`).join('\n');

        const system = `Tu es un expert JS Canvas. Tu dois CORRIGER la classe MiniGame fournie.
        Si l'utilisateur rapporte que 'start is not a function', c'est que tu as oublié de l'écrire. INCLUS-LA.
        
        RAPPEL DU CONTRAT :
        - Classe MiniGame
        - constructor(canvas, assets)
        - start() <--- INDISPENSABLE
        - loop(), update(), draw()
        - destroy()

        Réponds en JSON uniquement. Explique brièvement tes corrections dans 'message'.`;

        const prompt = `CODE ACTUEL :\n${currentCode}\n\nRETOUR ÉLÈVE/DÉFAUT : "${userInstruction}"\nACTEURS : ${actorsContext}`;

        try {
            const raw = await AIEngine.ask(prompt, system);
            return AIEngine.sanitizeJSON(raw);
        } catch (e) { throw e; }
    }
};

module.exports = GameGeneratorAI;
