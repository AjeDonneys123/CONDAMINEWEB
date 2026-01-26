const AIEngine = require('../../../core/ai.engine');
const fs = require('fs');
const path = require('path');

const ScanAI = {
    correctCopy: async (copyUrl, subjectUrls, instructions, studentList) => {
        console.log("👁️ [SCAN-AI] Correction Expert (Protocole Strict)...");

        const rosterText = studentList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

        // INSTRUCTIONS STRICTES DU PROFESSEUR
        const system = `Tu es un professeur correcteur expert.
        
        TES OBJECTIFS :
        1. **IDENTIFICATION** : Identifie l'élève grâce au nom sur la copie parmi cette liste : [${rosterText}]. Si introuvable, dis "Inconnu".
        2. **APPRÉCIATION GLOBALE** : Mets en haut une appréciation globale sur le travail.
        3. **NOTATION STRICTE** : Attribue une note LETTRE selon ce barème :
           - "A+" : TRÈS BON DEVOIR. Excellent.
           - "A" : DEVOIR CORRECT OU BON. L'essentiel attendu est là.
           - "B" : COMPÉTENCES EN COURS D'ACQUISITION. Certains éléments présents mais pas la majorité.
           - "C" : TRAVAIL INSUFFISANT. Très peu d'éléments attendus, manque de sérieux visible.
        4. **CORRECTION** : Retranscris le texte et insère les corrections en HTML (<span style="color:red">...</span>).

        FORMAT JSON ATTENDU (Sans markdown) :
        {
            "studentName": "Nom Trouvé",
            "grade": "A", 
            "appreciation": "Ton appréciation globale ici...",
            "transcription": "Le texte corrigé...",
            "mistakes": ["Liste", "des", "fautes"]
        }`;

        const promptParts = [
            { text: `INSTRUCTIONS SUPPLÉMENTAIRES : ${instructions}\n\nAnalyse cette copie.` }
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
                grade: "C", 
                appreciation: "L'IA n'a pas pu lire la copie. Vérifiez la qualité de la photo.", 
                transcription: "Non disponible.", 
                mistakes: [] 
            };
        }
    }
};

module.exports = ScanAI;