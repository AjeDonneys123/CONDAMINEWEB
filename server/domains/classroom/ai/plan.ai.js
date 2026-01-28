const AIEngine = require('../../../core/ai.engine');
const fs = require('fs');

/**
 * 🧠 INTELLIGENCE ARTIFICIELLE DE CLASSE
 * Spécialisée dans la reconnaissance spatiale des plans.
 */
const ClassroomAI = {
    
    analyzePlanImage: async (imagePath, mimeType, studentsList) => {
        console.log(`🧠 [PLAN-AI] Analyse visuelle (Mime: ${mimeType})...`);
        
        // 1. VÉRIFICATION DU TYPE (Sécurité)
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
        if (!allowedMimes.includes(mimeType)) {
            throw new Error("Format non supporté. Veuillez envoyer une IMAGE (Photo ou Capture d'écran du fichier Excel).");
        }

        // 2. Encodage
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');

        // 3. Contexte (Liste Élèves)
        // On envoie une version très compacte pour aider la reconnaissance OCR
        const rosterContext = studentsList.map(s => `${s.firstName} ${s.lastName} (ID:${s._id})`).join('\n');

        const system = `Tu es un architecte spatial expert en plans de classe.
        Ta mission : Convertir une IMAGE de plan (dessin ou capture écran Excel) en coordonnées numériques.
        
        DONNÉES EN ENTRÉE :
        - Une image montrant la disposition des tables.
        - Une liste d'élèves officielle (pour corriger l'orthographe lue sur l'image).

        RÈGLES DE SORTIE :
        1. Tu dois reconnaître les noms sur l'image et les mapper avec les IDs fournis.
        2. Tu dois déduire une grille logique (SeatX, SeatY).
           - X = Colonne (0 à gauche)
           - Y = Rangée (0 en haut, devant le tableau)
        3. Réponds UNIQUEMENT un tableau JSON valide.
        
        FORMAT JSON ATTENDU :
        [
          { "studentId": "ID_DE_LA_LISTE", "seatX": 0, "seatY": 0 },
          { "studentId": "...", "seatX": 1, "seatY": 0 }
        ]
        
        LISTE OFFICIELLE DES ÉLÈVES :
        ${rosterContext}`;

        const prompt = [
            { text: "Analyse ce plan visuel et génère la grille JSON correspondante." },
            { inlineData: { mimeType: mimeType, data: base64Image } }
        ];

        try {
            // Appel au moteur (qui gère maintenant les arrays sans crasher)
            const resultRaw = await AIEngine.ask(prompt, system);
            const result = AIEngine.sanitizeJSON(resultRaw);
            
            console.log(`🧠 [PLAN-AI] Succès : ${result.length} élèves identifiés.`);
            return result;

        } catch (e) {
            console.error("❌ [PLAN-AI] Erreur :", e.message);
            throw new Error("L'IA n'a pas pu lire l'image. Assurez-vous qu'elle est nette et lisible.");
        }
    }
};

module.exports = ClassroomAI;
