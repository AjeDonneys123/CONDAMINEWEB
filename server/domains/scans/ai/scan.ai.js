const AIEngine = require('../../../core/ai.engine');
const fs = require('fs');
const path = require('path');

const ScanAI = {
    correctCopy: async (copyUrl, subjectUrls, instructions, studentList) => {
        console.log("👁️ [SCAN-AI] Correction Expert (Mode /20)...");

        const rosterText = studentList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

        // INSTRUCTIONS STRICTES DU PROFESSEUR
        const system = `Tu es un professeur correcteur expert.
        
        TES OBJECTIFS (ORDRE DE PRIORITÉ) :
        1. **IDENTIFICATION** : Trouve le nom de l'élève sur la copie parmi : [${rosterText}]. Si introuvable, dis "Inconnu".
        2. **TRANSCRIPTION** : Retranscris le contenu manuscrit de la copie (corrige les fautes d'orthographe mineures dans la transcription mais note-les).
        3. **COMMENTAIRES** : Donne une appréciation constructive et des conseils.
        4. **NOTE** : Attribue une note sur 20 (ex: 14/20).

        FORMAT JSON ATTENDU (Sans markdown) :
        {
            "studentName": "Nom Trouvé",
            "transcription": "Le texte lu...",
            "appreciation": "Tes commentaires ici...",
            "grade": "15/20",
            "mistakes": []
        }`;

        const promptParts = [
            { text: `CONSIGNES SPÉCIFIQUES DU PROFESSEUR : ${instructions}\n\nAnalyse cette copie.` }
        ];

        try {
            const copyPath = path.join(process.cwd(), 'public', copyUrl);
            if (fs.existsSync(copyPath)) {
                promptParts.push({ inlineData: { mimeType: "image/jpeg", data: fs.readFileSync(copyPath).toString('base64') } });
            }
            
            if (subjectUrls && subjectUrls.length > 0) {
                const sPath = path.join(process.cwd(), 'public', subjectUrls[0]);
                if (fs.existsSync(sPath)) {
                    promptParts.push({ inlineData: { mimeType: "image/jpeg", data: fs.readFileSync(sPath).toString('base64') } });
                }
            }

            const raw = await AIEngine.ask(promptParts, system);
            return AIEngine.sanitizeJSON(raw);
        } catch (e) {
            console.error("Scan AI Error:", e);
            return { 
                studentName: "Erreur Lecture", 
                grade: "0/20", 
                appreciation: "L'IA n'a pas pu lire la copie. Vérifiez la qualité de la photo.", 
                transcription: "Non disponible.", 
                mistakes: [] 
            };
        }
    }
};

module.exports = ScanAI;