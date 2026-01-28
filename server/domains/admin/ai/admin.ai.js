const AIEngine = require('../../../core/ai.engine');

const AdminAI = {
    parseRawStudentData: async (rawText, contextClass) => {
        console.log("🧠 [AI] Analyse Magic Import V166 (Mode Tableau)...");
        
        const system = `Tu es un expert en extraction de données scolaires (Data Mining).
        Ta mission : Convertir un texte en vrac (ou un tableau copié-collé) en JSON strict.

        RÈGLES D'EXTRACTION :
        1. STRUCTURE : Si tu vois des barres '|', c'est un tableau. Utilise les en-têtes pour identifier les colonnes.
        2. IDENTITÉ : Cherche 'Nom', 'Prénom', 'Élève'. Sépare Nom et Prénom.
        3. CLASSE : Cherche une colonne 'Classe'. Si elle existe (ex: 2C, 2D), utilise-la pour chaque élève ! Sinon, utilise le contexte "${contextClass}".
        4. OPTIONS : Cherche la colonne 'Options'. Si elle contient plusieurs matières, sépare-les.
           - Mots clés options : SPE, LVA, LVB, DNL, BFI, SC. LABO, CAV, PORTUGAIS, ESPAGNOL, ANGLAIS.
        5. EMAIL : Cherche la colonne 'E-mail'. C'est la clé unique.

        EXEMPLE D'ENTRÉE :
        | Élève | Classe | Options |
        | Dupont Jean | 2C | CAV, LVA ANGLAIS |

        SORTIE ATTENDUE :
        [
          {
            "firstName": "Jean",
            "lastName": "DUPONT",
            "email": "...", // Si trouvé
            "className": "2C",
            "options": ["CAV", "LVA ANGLAIS"]
          }
        ]
        
        RÉPOND UNIQUEMENT LE JSON.`;

        const prompt = `ANALYSE CE TEXTE :\n\n${rawText.substring(0, 20000)}`;

        try {
            const response = await AIEngine.ask(prompt, system);
            const result = AIEngine.sanitizeJSON(response);
            console.log(`🧠 [AI] ${result.length} élèves extraits.`);
            return result;
        } catch (e) {
            console.error("❌ AI Parsing Failed:", e.message);
            // On renvoie un tableau vide pour ne pas crasher le serveur
            return [];
        }
    }
};

module.exports = AdminAI;
