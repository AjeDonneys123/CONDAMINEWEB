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
        console.log("👁️ [SCAN-AI] Correction V127 (Transcription Hardcore)...");

        const rosterText = studentList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

        const system = `Tu es un automate de transcription JSON.
        
        MISSION UNIQUE :
        1. Lis le texte manuscrit sur l'image.
        2. Recopie-le MOT POUR MOT (Transcription littérale).
        3. Si tu vois une faute ou une erreur par rapport à la consigne "${instructions}", insère une correction.

        RÈGLES DE FORMATAGE (Non négociables) :
        - Le texte de l'élève est en texte normal (Noir par défaut).
        - Tes corrections sont OBLIGATOIREMENT entre crochets rouges : <span style="color:#ef4444; font-weight:bold;"> [CORRECTION] </span>.
        - INTERDICTION de faire une liste à puces pour la transcription. Garde les phrases de l'élève.
        - INTERDICTION d'ajouter des phrases de politesse ("Voici l'analyse", "Bonjour").

        FORMAT DE SORTIE JSON STRICT :
        {
            "studentName": "Nom trouvé sur la copie (ou Inconnu)",
            "grade": "Note (A+, A, B, C)",
            "appreciation": "Bilan global en 2 phrases max.",
            "transcription": "Le texte exact de l'élève avec tes corrections rouges insérées au fil de l'eau.",
            "mistakes": ["Liste brève des concepts non acquis"]
        }`;

        const promptParts = [
            { text: "START JSON GENERATION." }
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
                console.error("Err Image", e.message);
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
                promptParts.push({ text: "IMAGE À TRANSCRIRE." });
            } else {
                return {
                    studentName: "Image Illisible",
                    grade: "C",
                    appreciation: "Fichier non trouvé.",
                    transcription: "Erreur technique.",
                    mistakes: []
                };
            }

            const rawText = await AIEngine.ask(promptParts, system);
            return AIEngine.sanitizeJSON(rawText);

        } catch (e) {
            return { 
                studentName: "Erreur", 
                grade: "?", 
                appreciation: "Erreur critique IA.", 
                transcription: e.message, 
                mistakes: [] 
            };
        }
    }
};

module.exports = ScanAI;