

const AIEngine = require('../../../core/ai.engine');

/**
 * 🧠 COUCHE IA ADMIN v.27 (Smart Columns Fix)
 * Correction : Empêche les emails de finir dans healthInfo
 */
const AdminAI = {
    extractStudentsFromInput: async (dataPayload) => {
        const system = "Tu es un expert Data Scientist scolaire. Tu dois structurer des données CSV/Excel complexes en JSON riche.";
        
        let prompt = [];
        prompt.push("ANALYSE CES DONNÉES SCOLAIRES (Liste Excel/CSV en vrac).");
        prompt.push("ATTENTION AUX DÉCALAGES DE COLONNES !");
        
        prompt.push("RÈGLES D'EXTRACTION STRICTES :");
        prompt.push("1. EMAIL : Contient OBLIGATOIREMENT '@'. Doit aller dans le champ 'email'. JAMAIS ailleurs.");
        prompt.push("2. SANTÉ/INFO : Contient 'PAI', 'PPRE', 'Dys', 'Allergie'. NE DOIT JAMAIS CONTENIR D'EMAIL.");
        prompt.push("3. NOMS : Souvent en MAJUSCULES. Sépare bien Prénom et NOM.");
        prompt.push("4. OPTIONS : Mots clés 'BFI', 'DNL', 'LVA', 'LVB', 'SECTION', 'CULTURE'.");
        
        prompt.push("FORMAT JSON ATTENDU :");
        prompt.push(`
        [
            {
                "firstName": "Amaia",
                "lastName": "ARGUELLO",
                "email": "amaia@condamine.edu.ec",
                "gender": "Féminin",
                "options": ["Option 1", "Option 2"],
                "healthInfo": "PAI (Asthme)"  // PAS D'EMAIL ICI !
            }
        ]
        `);

        if (dataPayload.text) {
            prompt.push(`👇 DONNÉES BRUTES 👇\n${dataPayload.text.substring(0, 20000)}`);
        }
        
        if (dataPayload.image) {
            const base64Data = dataPayload.image.split(',')[1];
            prompt.push({
                inlineData: {
                    data: base64Data,
                    mimeType: "image/jpeg"
                }
            });
            prompt.push("Ceci est une capture Excel. Fais attention à ne pas mélanger les colonnes Email et Santé.");
        }

        try {
            const rawResponse = await AIEngine.ask(prompt, system);
            let students = AIEngine.sanitizeJSON(rawResponse);
            
            // FILTRE DE SÉCURITÉ POST-IA (Pour être sûr à 100%)
            students = students.map(s => {
                // Si l'IA a mis un email dans healthInfo, on corrige
                if (s.healthInfo && s.healthInfo.includes('@')) {
                    if (!s.email) s.email = s.healthInfo; // On récupère l'email si manquant
                    s.healthInfo = ""; // On nettoie le champ santé
                }
                // Si l'email est dans le nom (ça arrive), on nettoie
                if (s.lastName && s.lastName.includes('@')) s.lastName = s.lastName.replace(/@.*/, '').trim();
                
                return s;
            });
            
            return students;
        } catch (e) {
            console.error("AI Admin Error:", e);
            throw new Error("L'IA n'a pas réussi à structurer ces données complexes.");
        }
    }
};

module.exports = AdminAI;

