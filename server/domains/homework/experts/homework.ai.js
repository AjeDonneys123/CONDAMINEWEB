const AIEngine = require('../../../core/ai.engine');
const fs = require('fs');
const path = require('path');

const HomeworkAI = {
    // ANALYSE RÉPONSE ÉLÈVE
    analyze: async (userText, instruction, aiHints) => {
        const system = `Tu es un professeur. Tu dois noter la réponse de l'élève selon un barème strict et donner un feedback constructif.

        BARÈME OBLIGATOIRE :
        - "C" (ROUGE) : Travail bâclé, hors-sujet, très insuffisant ou trop court. Ton feedback doit être ferme.
        - "B" (JAUNE) : L'élève a compris certains éléments et fait un effort, mais le résultat est incomplet ou maladroit. Ton feedback doit l'encourager à compléter sa réponse.
        - "A" (VERT CLAIR) : Bon travail, les exigences sont respectées. Ton feedback doit dire "Bien dans l'ensemble" et ajouter un petit conseil pour atteindre l'excellence la prochaine fois.
        - "A+" (VERT FONCÉ) : Excellent, parfait, dépasse les attentes. Félicitations.

        Format de réponse JSON attendu :
        {
            "grade": "A", // A+, A, B ou C
            "feedback_fond": "Ton commentaire pédagogique ici..."
        }`;

        const prompt = `CONSIGNE : "${instruction}"
        AIDE CORRECTION (GRID) : "${aiHints}"
        RÉPONSE ÉLÈVE : "${userText}"
        
        Analyse cette réponse et attribue la note (C, B, A, A+).`;

        try {
            const res = await AIEngine.ask(prompt, system);
            return AIEngine.sanitizeJSON(res);
        } catch (e) {
            console.error("AI Analyze Error", e);
            // Fallback en cas de crash IA
            return { grade: "B", feedback_fond: "Erreur d'analyse, veuillez réessayer." };
        }
    },

    // GÉNÉRATION DE GRILLE (Inchangé mais inclus pour intégrité fichier)
    generateHintsFromAssets: async (instruction, imageUrls) => {
        console.log("🧠 [AI-HINTS] Analyse multimodal...");
        const system = "Tu es un expert pédagogique. Rédige une grille de correction précise (points clés, dates, chiffres attendus) basée sur les documents.";
        const promptParts = [{ text: `CONSIGNE : ${instruction || "Non précisée"}\n\nAnalyse les images et donne les éléments de réponse attendus.` }];
        
        imageUrls.forEach(url => {
            const fileName = url.split('/').pop();
            const filePath = path.join(process.cwd(), 'public', 'uploads', fileName);
            if (fs.existsSync(filePath)) {
                const buffer = fs.readFileSync(filePath);
                promptParts.push({ inlineData: { mimeType: "image/png", data: buffer.toString('base64') } });
            }
        });

        try {
            return await AIEngine.ask(promptParts, system);
        } catch (e) { return "Analyse impossible."; }
    }
};

module.exports = HomeworkAI;