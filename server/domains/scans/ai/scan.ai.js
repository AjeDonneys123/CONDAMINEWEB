const AIEngine = require('../../../core/ai.engine');
const StructureDrive = require('../../structure/experts/structure.drive'); 

const streamToBuffer = async (stream) => {
    const chunks = [];
    return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
};

const ScanAI = {
    correctCopy: async (copyUrl, subjectUrls, instructions, studentList) => {
        console.log("👁️ [SCAN-AI] Correction V119 (Mode API Strict)...");

        const rosterText = studentList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

        // ON CHANGE DE PERSONA : Ce n'est plus un prof, c'est une MACHINE.
        const system = `Tu es une API JSON stricte. Tu n'es PAS un assistant conversationnel.
        
        TÂCHE : Analyser la copie d'un élève (fournie en image) par rapport au sujet.
        
        RÈGLES D'OR (Non-négociables) :
        1. NE DIS PAS "Bonjour", NE DIS PAS "Voici l'analyse".
        2. RENVOIE UNIQUEMENT UN OBJET JSON. RIEN AVANT, RIEN APRÈS.
        3. CODE COULEUR : Pour les corrections dans le texte, utilise UNIQUEMENT le HTML suivant : <span style="color:#ef4444; font-weight:bold;">[Ton commentaire]</span>. N'utilise PAS de Markdown (**Gras**).
        
        LISTE ÉLÈVES POSSIBLES : [${rosterText}].

        FORMAT JSON À RESPECTER :
        {
            "studentName": "Nom trouvé ou 'Inconnu'",
            "grade": "Note (A+, A, B ou C)",
            "appreciation": "Résumé court (2 phrases).",
            "transcription": "Ton analyse complète avec les balises HTML <span...> pour tes corrections.",
            "mistakes": ["Erreur 1", "Erreur 2"]
        }`;

        const promptParts = [
            { text: `INSTRUCTIONS PROF : ${instructions}` }
        ];

        const getImageData = async (url) => {
            try {
                if (url.includes('/proxy/')) {
                    const fileId = url.split('/proxy/')[1];
                    const stream = await StructureDrive.getFileStream(fileId);
                    const buffer = await streamToBuffer(stream);
                    if (buffer.length < 100) throw new Error("Fichier vide");
                    return buffer.toString('base64');
                }
                return null;
            } catch (e) {
                console.error(`❌ [AI-FETCH] Erreur : ${e.message}`);
                return null;
            }
        };

        try {
            if (subjectUrls) {
                for (const url of subjectUrls) {
                    const b64 = await getImageData(url);
                    if (b64) promptParts.push({ inlineData: { mimeType: "image/jpeg", data: b64 } });
                }
            }

            const copyB64 = await getImageData(copyUrl);
            if (copyB64) {
                promptParts.push({ inlineData: { mimeType: "image/jpeg", data: copyB64 } });
                promptParts.push({ text: "ANALYSE JSON STRICTE." });
            } else {
                return {
                    studentName: "Image Illisible",
                    grade: "C",
                    appreciation: "Impossible de lire le fichier.",
                    transcription: "Erreur technique Drive.",
                    mistakes: []
                };
            }

            const rawText = await AIEngine.ask(promptParts, system);
            return AIEngine.sanitizeJSON(rawText);

        } catch (e) {
            return { 
                studentName: "Erreur", 
                grade: "?", 
                appreciation: "Erreur critique.", 
                transcription: e.message, 
                mistakes: [] 
            };
        }
    }
};

module.exports = ScanAI;