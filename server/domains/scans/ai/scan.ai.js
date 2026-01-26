const AIEngine = require('../../../core/ai.engine');
const StructureDrive = require('../../structure/experts/structure.drive'); 

// Helper Stream -> Buffer
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
        console.log("👁️ [SCAN-AI] Correction V113 (Verbose)...");

        const rosterText = studentList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

        const system = `Tu es un professeur correcteur.
        Si l'image est illisible, dis-le.
        Si l'image est lisible, corrige.
        
        FORMAT JSON :
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
                    console.log(`☁️ [SCAN] Fetch Drive ID: ${fileId}`);
                    const stream = await StructureDrive.getFileStream(fileId);
                    const buffer = await streamToBuffer(stream);
                    if (buffer.length < 100) throw new Error("Fichier vide");
                    return buffer.toString('base64');
                }
                console.log("⚠️ [SCAN] Lien non-proxy ignoré (Local):", url);
                return null;
            } catch (e) {
                console.error(`❌ [SCAN] Erreur Drive : ${e.message}`);
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
                    appreciation: "Le fichier image n'est pas accessible sur le Drive.",
                    transcription: "URL testée : " + copyUrl,
                    mistakes: []
                };
            }

            // Appel IA
            const rawText = await AIEngine.ask(promptParts, system);
            
            // Le moteur V12 (celui qui est sur ton PC) ne plante jamais.
            return AIEngine.sanitizeJSON(rawText);

        } catch (e) {
            return { 
                studentName: "Crash V113", 
                grade: "?", 
                appreciation: "Erreur critique dans le code.", 
                transcription: e.message, 
                mistakes: [] 
            };
        }
    }
};

module.exports = ScanAI;