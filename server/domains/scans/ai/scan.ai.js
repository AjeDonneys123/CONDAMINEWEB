const AIEngine = require('../../../core/ai.engine');
const fs = require('fs');
const path = require('path');

const ScanAI = {
    correctCopy: async (copyUrl, subjectUrls, instructions, studentList) => {
        console.log("👁️ [SCAN-AI] Correction Expert (Sujet + Copie)...");

        const rosterText = studentList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

        const system = `Tu es un professeur correcteur expert.
        
        INPUT :
        1. Une ou plusieurs images de l'ÉNONCÉ (SUJET).
        2. Une image de la COPIE de l'élève.
        
        TES OBJECTIFS :
        1. **ANALYSE SUJET** : Comprends d'abord ce qui était demandé dans l'énoncé.
        2. **IDENTIFICATION** : Trouve le nom de l'élève sur la copie parmi : [${rosterText}].
        3. **CORRECTION** : Vérifie si la copie répond correctement aux questions du sujet.
        4. **NOTE** : Attribue une note sur 20.

        FORMAT JSON ATTENDU :
        {
            "studentName": "Nom Trouvé",
            "transcription": "Retranscription partielle et commentaires...",
            "appreciation": "Ton feedback pédagogique...",
            "grade": "15/20",
            "mistakes": []
        }`;

        // Construction du payload multimédia
        const promptParts = [
            { text: `INSTRUCTIONS PROF : ${instructions}\n\nVoici d'abord l'énoncé, puis la copie.` }
        ];

        // 1. Ajout des Sujets (En premier pour le contexte)
        if (subjectUrls && subjectUrls.length > 0) {
            subjectUrls.forEach(url => {
                const sPath = path.join(process.cwd(), 'public', url);
                if (fs.existsSync(sPath)) {
                    promptParts.push({ inlineData: { mimeType: "image/jpeg", data: fs.readFileSync(sPath).toString('base64') } });
                    promptParts.push({ text: "[IMAGE ÉNONCÉ]" });
                }
            });
        }

        // 2. Ajout de la Copie
        const copyPath = path.join(process.cwd(), 'public', copyUrl);
        if (fs.existsSync(copyPath)) {
            promptParts.push({ inlineData: { mimeType: "image/jpeg", data: fs.readFileSync(copyPath).toString('base64') } });
            promptParts.push({ text: "[IMAGE COPIE ÉLÈVE]" });
        }

        try {
            const raw = await AIEngine.ask(promptParts, system);
            return AIEngine.sanitizeJSON(raw);
        } catch (e) {
            console.error("Scan AI Error:", e);
            return { 
                studentName: "Erreur", 
                grade: "?/20", 
                appreciation: "Impossible de lire les images.", 
                transcription: "", 
                mistakes: [] 
            };
        }
    }
};

module.exports = ScanAI;