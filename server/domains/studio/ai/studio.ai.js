const AIEngine = require('../../../core/ai.engine');

/**
 * 🧠 COUCHE IA STUDIO
 * Spécialisée dans la génération de prompts artistiques.
 */
const StudioAI = {
    optimizeAssetPrompt: async (userPrompt, type) => {
        console.log(`🎨 [STUDIO-AI] Optimisation du prompt pour : ${type}`);
        
        const styleContext = type === 'character' 
            ? "sprite 2D, vector style, flat colors, white background, full body, video game asset style, no shadow"
            : "video game background, 2D vector art, scenic, flat style, colorful, wide angle";
            
        const systemInstruction = "Tu es un expert en Prompts pour IA générative d'images (Stable Diffusion/Midjourney). Traduis et optimise la demande en Anglais pour un résultat style Cartoon/Jeu Vidéo.";
        
        const prompt = `Transforme cette demande : "${userPrompt}" en un prompt descriptif technique en anglais.
        Ajoute impérativement ce style : ${styleContext}.
        Réponds UNIQUEMENT le prompt anglais, sans guillemets, sans texte avant ni après.`;

        try {
            return await AIEngine.ask(prompt, systemInstruction);
        } catch (e) {
            console.error("❌ [STUDIO-AI] Erreur:", e.message);
            // Fallback si l'IA échoue : on renvoie le prompt utilisateur + style
            return `${userPrompt}, ${styleContext}`;
        }
    }
};

module.exports = StudioAI;
