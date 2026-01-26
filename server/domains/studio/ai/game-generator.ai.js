const AIEngine = require('../../../core/ai.engine');

/**
 * 🕹️ GÉNÉRATEUR DE JEUX VIDÉO (GEMINI 2.0)
 * Transforme des assets et une idée en code JavaScript jouable.
 */
const GameGeneratorAI = {
    
    generateGameCode: async (gameIdea, actors) => {
        console.log("🕹️ [GAME-GEN] Génération du code de jeu...");

        // Description des acteurs pour l'IA
        const actorsContext = actors.map((a, i) => 
            `Actor ${i+1}: Name="${a.name}", ID="${a.id}", SpriteURL="${a.costumes[0]?.url || ''}"`
        ).join('\n');

        const system = `Tu es un expert en développement de jeux HTML5 Canvas (2D).
        Ta mission : Générer une classe JavaScript unique qui implémente le jeu demandé.
        
        CONTRAINTES TECHNIQUES STRICTES :
        1. Le code doit être une classe nommée 'MiniGame'.
        2. Elle doit avoir un constructeur(canvas, assets). 'assets' est un objet { "ID_ACTEUR": ImageObject }.
        3. Elle doit avoir une méthode 'update(dt)' (dt en secondes).
        4. Elle doit avoir une méthode 'draw(ctx)'.
        5. Elle doit gérer les événements clavier/souris elle-même via document.addEventListener (et les nettoyer dans une méthode destroy()).
        6. Le code doit être ROBUSTE : pas d'erreurs si une image manque.
        7. N'utilise PAS d'alert(), dessine le 'Game Over' ou le score sur le canvas.
        
        FORMAT DE SORTIE :
        Renvoie UNIQUEMENT le code JavaScript brut. Pas de markdown, pas de balises <script>.`;

        const prompt = `
        IDÉE DU JEU : "${gameIdea}"
        
        ACTEURS DISPONIBLES :
        ${actorsContext}
        
        Écris la classe MiniGame. Fais un jeu simple, amusant et jouable immédiatement.
        Gère le score, les collisions et les conditions de victoire/défaite.`;

        try {
            const code = await AIEngine.ask(prompt, system);
            // Nettoyage éventuel du markdown
            return code.replace(/```javascript/g, '').replace(/```/g, '').trim();
        } catch (e) {
            console.error("Game Gen Error:", e);
            throw new Error("L'IA n'a pas pu coder le jeu.");
        }
    },

    // Remix Visuel (Image -> Description -> Nouvelle Image)
    remixAssetDescription: async (imageBuffer) => {
        const system = "Tu es un directeur artistique. Décris cette image en anglais pour un prompt de génération (Stable Diffusion). Sois précis sur le style (Flat, 2D, Vector, Video Game Asset).";
        const prompt = [{ text: "Décris ce personnage/objet pour en refaire une variante." }, { inlineData: { mimeType: "image/png", data: imageBuffer.toString('base64') } }];
        
        const description = await AIEngine.ask(prompt, system);
        return description + ", vector style, white background, no shadow, game asset";
    }
};

module.exports = GameGeneratorAI;