const AIEngine = require('../../../core/ai.engine');

const GameGeneratorAI = {
    
    generateGameCode: async (gameIdea, actors) => {
        console.log("🕹️ [GAME-GEN] Génération du code de jeu...");

        const actorsContext = actors.map((a, i) => {
            const sprite = (a.costumes && a.costumes.length > 0) ? a.costumes[0].url : "";
            return `Actor ${i+1}: Name="${a.name}", ID="${a.id}", SpriteURL="${sprite}"`;
        }).join('\n');

        const system = `Tu es un expert en développement de jeux HTML5 Canvas (2D).
        
        TES OBJECTIFS :
        1. Générer une classe JavaScript 'MiniGame'.
        2. Expliquer brièvement ce que tu as fait ou corrigé.

        CONTRAINTES TECHNIQUES STRICTES :
        - La classe doit avoir : constructor(canvas, assets), update(dt), draw(ctx), destroy().
        - GESTION CLAVIER : Pour la barre d'espace ('Space' ou ' '), tu DOIS utiliser e.preventDefault() pour empêcher le défilement de la page.
        - NETTOYAGE : destroy() doit supprimer tous les event listeners.
        - ROBUSTESSE : Pas de crash si une image manque.
        - PAS D'ALERT() : Dessine le Game Over sur le canvas.

        FORMAT DE RÉPONSE ATTENDU (JSON STRICT) :
        {
            "code": "Le code JavaScript complet de la classe...",
            "message": "Une explication courte (1 phrase) de ce que tu as implémenté ou corrigé pour le créateur."
        }`;

        const prompt = `IDÉE DU JEU : "${gameIdea}"\nACTEURS : ${actorsContext}\n\nGénère le code et le message explicatif.`;

        try {
            const raw = await AIEngine.ask(prompt, system);
            return AIEngine.sanitizeJSON(raw);
        } catch (e) { 
            console.error(e);
            // Fallback si l'IA plante le JSON
            return { code: "", message: "Erreur de génération IA." }; 
        }
    },

    fixGameCode: async (currentCode, errorLog, userInstruction) => {
        console.log("🔧 [GAME-FIX] Réparation du code...");

        const system = `Tu es un expert en débogage JavaScript pour jeux Canvas.
        
        FORMAT DE RÉPONSE ATTENDU (JSON STRICT) :
        {
            "code": "Le code corrigé...",
            "message": "Explication de la correction (ex: 'J'ai ajouté preventDefault sur la barre d'espace')."
        }
        
        RÈGLE D'OR : Si le problème concerne la barre d'espace qui fait scroller ou reload, ajoute 'e.preventDefault()' dans l'écouteur d'événement.`;

        const prompt = `
        CODE ACTUEL :
        ${currentCode}

        ERREUR / DEMANDE :
        "${errorLog || userInstruction}"

        Corrige le code et explique pourquoi.`;

        try {
            const raw = await AIEngine.ask(prompt, system);
            return AIEngine.sanitizeJSON(raw);
        } catch (e) { throw new Error("L'IA n'a pas pu réparer le code."); }
    },

    remixAssetDescription: async (imageBuffer) => {
        const system = "Tu es un directeur artistique. Décris cette image en anglais pour un prompt de génération.";
        const prompt = [{ text: "Décris ce personnage/objet." }, { inlineData: { mimeType: "image/png", data: imageBuffer.toString('base64') } }];
        const desc = await AIEngine.ask(prompt, system);
        return desc + ", vector style, white background, game asset";
    }
};

module.exports = GameGeneratorAI;