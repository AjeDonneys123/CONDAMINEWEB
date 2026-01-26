const AIEngine = require('../../../core/ai.engine');
const StructureDrive = require('../../structure/experts/structure.drive'); 

// Helper : Convertit un Stream en Buffer (Indispensable pour le Drive)
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
        console.log("👁️ [SCAN-AI] Correction V12...");

        const rosterText = studentList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

        const system = `Tu es un professeur correcteur.
        
        FORMAT JSON OBLIGATOIRE :
        {
            "studentName": "Nom",
            "transcription": "...",
            "appreciation": "...",
            "grade": "15/20",
            "mistakes": []
        }`;

        const promptParts = [
            { text: `INSTRUCTIONS : ${instructions}` }
        ];

        const getImageData = async (url) => {
            try {
                if (url.includes('/proxy/')) {
                    const fileId = url.split('/proxy/')[1];
                    console.log(`☁️ Download Drive ID: ${fileId}`);
                    const stream = await StructureDrive.getFileStream(fileId);
                    const buffer = await streamToBuffer(stream);
                    if (buffer.length < 100) throw new Error("Fichier vide");
                    return buffer.toString('base64');
                }
                console.log("⚠️ Lien non-proxy ignoré:", url);
                return null;
            } catch (e) {
                console.error(`❌ Erreur Image : ${e.message}`);
                return null;
            }
        };

        try {
            // Sujets
            if (subjectUrls) {
                for (const url of subjectUrls) {
                    const b64 = await getImageData(url);
                    if (b64) {
                        promptParts.push({ inlineData: { mimeType: "image/jpeg", data: b64 } });
                        promptParts.push({ text: "[SUJET]" });
                    }
                }
            }

            // Copie
            const copyB64 = await getImageData(copyUrl);
            if (copyB64) {
                promptParts.push({ inlineData: { mimeType: "image/jpeg", data: copyB64 } });
                promptParts.push({ text: "[COPIE]" });
            } else {
                return {
                    studentName: "Image Perdue",
                    grade: "0",
                    appreciation: "Impossible de récupérer l'image sur le Drive.",
                    transcription: "URL: " + copyUrl,
                    mistakes: []
                };
            }

            // Appel IA via le Moteur V12
            const rawText = await AIEngine.ask(promptParts, system);
            return AIEngine.sanitizeJSON(rawText);

        } catch (e) {
            return { 
                studentName: "Bug Critique", 
                grade: "?", 
                appreciation: "Erreur Scan AI : " + e.message, 
                transcription: "", 
                mistakes: [] 
            };
        }
    }
};

module.exports = ScanAI;