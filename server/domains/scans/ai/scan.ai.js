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
        console.log("👁️ [SCAN-AI] Correction V7 (Mode Nucléaire)...");

        const rosterText = studentList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

        const system = `Tu es un professeur.
        
        FORMAT JSON STRICT ATTENDU :
        {
            "studentName": "Nom",
            "transcription": "Analyse...",
            "appreciation": "Avis...",
            "grade": "15/20",
            "mistakes": []
        }
        
        Si tu ne peux pas lire l'image, dis-le dans l'appréciation.`;

        const promptParts = [
            { text: `INSTRUCTIONS : ${instructions}` }
        ];

        const getImageData = async (url) => {
            try {
                if (url.includes('/proxy/')) {
                    const fileId = url.split('/proxy/')[1];
                    const stream = await StructureDrive.getFileStream(fileId);
                    const buffer = await streamToBuffer(stream);
                    if (buffer.length < 100) throw new Error("Fichier trop petit (corrompu)");
                    return buffer.toString('base64');
                }
                return null;
            } catch (e) {
                console.error(`❌ [AI-FETCH] Erreur Drive : ${e.message}`);
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
                // Si l'image est introuvable, on force l'IA à le dire
                return {
                    studentName: "Image Introuvable",
                    grade: "0",
                    appreciation: "Le fichier n'est pas accessible sur le Drive (Lien cassé ou problème de droits).",
                    transcription: "URL testée : " + copyUrl,
                    mistakes: []
                };
            }

            // 3. Appel IA (Sécurisé par AIEngine V11)
            const rawText = await AIEngine.ask(promptParts, system);
            
            // Le moteur V11 ne plante JAMAIS, il renvoie toujours un objet
            return AIEngine.sanitizeJSON(rawText);

        } catch (e) {
            return { 
                studentName: "Crash Système", 
                grade: "?", 
                appreciation: "Erreur critique dans le code de correction.", 
                transcription: e.message, 
                mistakes: [] 
            };
        }
    }
};

module.exports = ScanAI;