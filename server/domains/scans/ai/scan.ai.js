const AIEngine = require('../../../core/ai.engine');
const fs = require('fs');
const path = require('path');

const ScanAI = {
    correctCopy: async (copyUrl, subjectUrls, instructions, studentList) => {
        console.log("👁️ [SCAN-AI-EXPERT] Correction Multimodale avec Identification...");

        // On prépare la liste des élèves pour le matching
        const rosterText = studentList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

        const system = `Tu es un professeur correcteur expert et bienveillant.
        
        TA MISSION EST TRIPLE :
        1. **IDENTIFICATION** : Trouve le nom de l'élève écrit sur la copie parmi cette liste : [${rosterText}]. Si tu ne trouves pas, dis "Inconnu".
        2. **TRANSCRIPTION & CORRECTION** : Retranscris le texte. Quand tu vois une faute, corrige-la en insérant le texte corrigé ou un commentaire DANS LE TEXTE, entouré d'une balise HTML rouge : <span class="ia-correction">[Correction]</span>. Ajoute des retours à la ligne <br/> pour respecter la mise en page.
        3. **NOTATION** : Attribue une note sous forme de LETTRE selon ce barème strict :
           - A+ (Vert Foncé) : Excellent travail, parfait.
           - A  (Vert Clair) : Bon travail, compétences acquises.
           - B  (Jaune) : En cours d'acquisition, des efforts mais des lacunes.
           - C  (Rouge) : Insuffisant, travail bâclé ou hors-sujet.

        FORMAT DE RÉPONSE JSON STRICT :
        {
            "studentName": "Prénom Nom (ou Inconnu)",
            "transcription": "Le texte HTML avec les <span class='ia-correction'>[corrections rouges]</span>...",
            "mistakes": ["Liste", "des", "fautes", "majeures"],
            "appreciation": "Une phrase générale d'encouragement ou de conseil en haut de page.",
            "grade": "A+" 
        }`;

        const promptParts = [
            { text: `INSTRUCTIONS DU PROFESSEUR : ${instructions}\n\nAnalyse cette copie.` }
        ];

        const copyPath = path.join(process.cwd(), 'public', copyUrl);
        if (fs.existsSync(copyPath)) {
            promptParts.push({ inlineData: { mimeType: "image/jpeg", data: fs.readFileSync(copyPath).toString('base64') } });
        }

        // Ajout du sujet en contexte si présent
        if (subjectUrls && subjectUrls.length > 0) {
            promptParts.push({ text: "Voici le sujet de référence :" });
            for (const sUrl of subjectUrls) {
                const sPath = path.join(process.cwd(), 'public', sUrl);
                if (fs.existsSync(sPath)) {
                    promptParts.push({ inlineData: { mimeType: "image/jpeg", data: fs.readFileSync(sPath).toString('base64') } });
                }
            }
        }

        try {
            const raw = await AIEngine.ask(promptParts, system);
            return AIEngine.sanitizeJSON(raw);
        } catch (e) {
            console.error("Scan AI Error:", e);
            return { 
                studentName: "Erreur IA", 
                transcription: "Impossible de lire la copie.", 
                mistakes: [], 
                appreciation: "Erreur technique.", 
                grade: "B" 
            };
        }
    }
};

module.exports = ScanAI;