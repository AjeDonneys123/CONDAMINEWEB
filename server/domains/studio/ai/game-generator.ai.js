const AIEngine = require('../../../core/ai.engine');

const GameGeneratorAI = {
    
    generateGameCode: async (gameIdea, actors) => {
        console.log("🕹️ [GAME-GEN] Génération du code de jeu...");

        // On prépare une liste explicite pour l'IA
        const actorsContext = actors.map((a, i) => {
            return `ACTOR ${i+1} : 
            - Name: "${a.name}"
            - ID: "${a.id}" (UTILISE CET ID POUR L'ASSET !)
            - Role: ${i === 0 ? 'Player' : 'Enemy/Object'}`;
        }).join('\n');

        const system = `Tu es un expert en développement de jeux HTML5 Canvas.
        
        RÈGLES D'OR DU MOTEUR DE JEU :
        1. Les images sont dans l'objet 'assets'.
        2. LA CLÉ DE L'IMAGE EST L'ID DE L'ACTEUR, PAS SON NOM.
           Exemple : ctx.drawImage(this.assets['${actors[0]?.id || 'xxx'}'], x, y, w, h);
        3. Gestion Clavier : Utilise e.preventDefault() sur la barre d'espace.
        4. Nettoyage : destroy() doit tout arrêter.
        5. Rendu : Efface le canvas (clearRect) à chaque frame avant de dessiner.

        Génère une classe 'MiniGame' complète.`;

        const prompt = `CRÉE CE JEU : "${gameIdea}"
        
        LISTE DES ACTEURS ET LEURS IDs (A UTILISER POUR LES IMAGES) :
        ${actorsContext}

        FORMAT JSON : { "code": "...", "message": "..." }`;

        try {
            const raw = await AIEngine.ask(prompt, system);
            return AIEngine.sanitizeJSON(raw);
        } catch (e) { 
            return { code: "", message: "Erreur de génération IA." }; 
        }
    },

    fixGameCode: async (currentCode, errorLog, userInstruction) => {
        console.log("🔧 [GAME-FIX] Réparation du code...");

        const system = `Tu es un expert en débogage JavaScript Canvas.
        Ton but est de réparer le code fourni selon l'erreur ou la demande.
        
        RAPPEL IMPORTANT : Les images sont accessibles via this.assets['ID_ACTEUR'].
        Si l'utilisateur dit "on ne voit rien", vérifie que le drawImage utilise bien les bons IDs d'assets.`;

        const prompt = `CODE ACTUEL :
        ${currentCode}

        PROBLÈME / DEMANDE :
        "${errorLog || userInstruction}"

        Renvoie le code corrigé en JSON : { "code": "...", "message": "..." }`;

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
