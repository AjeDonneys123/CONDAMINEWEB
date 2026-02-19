const AIEngine = require('../../../core/ai.engine');
const fs = require('fs');

const ClassroomAI = {
    analyzePlanImage: async (imagePath, mimeType, studentsList) => {
        console.log(`🧠 [PLAN-AI] Analyse de l'image...`);
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');
        
        const rosterContext = studentsList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

        const system = `Tu es un expert en lecture de plans de classe. 
        Ta mission : Extraire les noms d'élèves et leurs positions (X, Y) depuis l'image.
        - X : Colonne (0 = à gauche de la classe)
        - Y : Rangée (0 = tout devant, près du tableau)
        
        Liste des élèves possibles : [${rosterContext}]
        
        Réponds UNIQUEMENT sous forme de tableau JSON :
        [{"name": "Nom de l'élève", "x": 0, "y": 0}]`;

        const prompt = [
            { text: "Convertis ce plan de classe visuel en grille JSON." },
            { inline_data: { mime_type: "image/jpeg", data: base64Image } }
        ];

        try {
            const resultRaw = await AIEngine.ask(prompt, system);
            return AIEngine.sanitizeJSON(resultRaw);
        } catch (e) {
            console.error("❌ Erreur Plan AI:", e.message);
            return [];
        }
    }
};

module.exports = ClassroomAI;
