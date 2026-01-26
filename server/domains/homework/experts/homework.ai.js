const AIEngine = require('../../../core/ai.engine');

const HomeworkAI = {
    analyze: async (userText, instruction, aiHints) => {
        const system = `Tu es un moteur d'évaluation scolaire automatique.
        
        BARÈME D'INTERACTION (RÈGLES D'OR) :
        1. **ROUGE "C" (INSUFFISANT)** : Si la réponse est vide, hors sujet, ou témoigne d'un manque de sérieux flagrant.
           -> CONSÉQUENCE : La réponse de l'élève sera EFFACÉE et il devra recommencer.
           
        2. **JAUNE "B" (EN COURS)** : Si la réponse contient des éléments justes mais est incomplète ou maladroite.
           -> CONSÉQUENCE : L'IA donnera des indices pour compléter.
           
        3. **VERT "A" (VALIDÉ)** : Si la réponse est correcte et complète.
           -> CONSÉQUENCE : Devoir validé.
           
        4. **VERT FONCÉ "A+" (EXCELLENT)** : Réponse parfaite, détaillée, orthographe soignée.
           -> CONSÉQUENCE : Félicitations spéciales.

        FORMAT JSON STRICT :
        {
            "grade": "C", // A+, A, B ou C
            "feedback_fond": "Ton feedback pédagogique court..."
        }`;

        const prompt = `Consigne Prof: "${instruction}"
        Indices de correction (cachés): "${aiHints}"
        
        RÉPONSE DE L'ÉLÈVE : "${userText}"
        
        Analyse et note.`;

        try {
            const raw = await AIEngine.ask(prompt, system);
            return AIEngine.sanitizeJSON(raw);
        } catch (e) {
            return { grade: "B", feedback_fond: "Analyse indisponible momentanément. Vérifiez votre réponse." };
        }
    },

    generateHintsFromAssets: async (instruction, imageUrls) => { return "Grille générée par analyse visuelle."; }
};

module.exports = HomeworkAI;