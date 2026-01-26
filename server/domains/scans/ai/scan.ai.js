const AIEngine = require('../../../core/ai.engine');
const StructureDrive = require('../../structure/experts/structure.drive'); 

// Helper : Convertit un Stream en Buffer
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
        console.log("👁️ [SCAN-AI] Correction Expert V5...");

        const rosterText = studentList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

        const system = `Tu es un professeur correcteur expert.
        
        TES OBJECTIFS :
        1. Identifie l'élève parmi : [${rosterText}].
        2. Corrige la copie.
        
        FORMAT DE RÉPONSE OBLIGATOIRE (JSON) :
        {
            "studentName": "Nom Prénom",
            "transcription": "Détail de la correction...",
            "appreciation": "Avis global...",
            "grade": "Note/20",
            "mistakes": ["Erreur 1", "Erreur 2"]
        }`;

        const promptParts = [
            { text: `INSTRUCTIONS : ${instructions}` }
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
            // 1. Sujets
            if (subjectUrls && subjectUrls.length > 0) {
                for (const url of subjectUrls) {
                    const b64 = await getImageData(url);
                    if (b64) {
                        promptParts.push({ inlineData: { mimeType: "image/jpeg", data: b64 } });
                        promptParts.push({ text: "[IMAGE ÉNONCÉ]" });
                    }
                }
            }

            // 2. Copie
            const copyB64 = await getImageData(copyUrl);
            if (copyB64) {
                promptParts.push({ inlineData: { mimeType: "image/jpeg", data: copyB64 } });
                promptParts.push({ text: "[IMAGE COPIE ÉLÈVE]" });
            } else {
                return {
                    studentName: "Image Illisible",
                    grade: "0/20",
                    appreciation: "Image non chargée depuis le Drive.",
                    transcription: "Erreur technique.",
                    mistakes: []
                };
            }

            // 3. Appel IA (Le moteur se charge de sécuriser le JSON maintenant)
            const rawText = await AIEngine.ask(promptParts, system);
            return AIEngine.sanitizeJSON(rawText);

        } catch (e) {
            // Filet de sécurité ultime
            return { 
                studentName: "Erreur Critique", 
                grade: "?", 
                appreciation: "Erreur interne code.", 
                transcription: e.message, 
                mistakes: [] 
            };
        }
    }
};

module.exports = ScanAI;