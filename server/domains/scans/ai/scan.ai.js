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
        console.log("👁️ [SCAN-AI] Correction V122 (Dictature JSON)...");

        const rosterText = studentList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

        // PROMPT BASÉ SUR L'EXEMPLE (One-Shot Learning)
        const system = `Tu es un automate de conversion JSON.
        
        TA TÂCHE :
        1. Lis le texte manuscrit sur l'image.
        2. Recopie-le mot pour mot.
        3. Insère tes corrections en ROUGE directement dans le texte.
        4. Donne une note (A, B, C).

        RÈGLE DE COULEUR OBLIGATOIRE :
        Utilise EXCLUSIVEMENT cette balise HTML pour tes commentaires : <span style="color:#ef4444; font-weight:bold;">[TON COMMENTAIRE ICI]</span>.
        
        EXEMPLE DE SORTIE ATTENDUE (Tu dois respecter ce format JSON strictement) :
        \`\`\`json
        {
            "studentName": "Jean Dupont",
            "grade": "B",
            "appreciation": "Bon travail global, attention à l'orthographe.",
            "transcription": "La capitale de la France est <span style=\\"color:#ef4444; font-weight:bold;\\">[Erreur: Paris, pas Lyon]</span> Lyon. Il y a beaucoup de monuments.",
            "mistakes": ["Géographie", "Orthographe"]
        }
        \`\`\`

        Liste des élèves : [${rosterText}].
        Consigne Prof : "${instructions}".`;

        const promptParts = [
            { text: "GÉNÈRE LE JSON MAINTENANT." }
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
                console.error(`❌ [AI] Erreur : ${e.message}`);
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
                promptParts.push({ text: "IMAGE À TRAITER :" });
            } else {
                return {
                    studentName: "Image Perdue",
                    grade: "C",
                    appreciation: "Fichier illisible.",
                    transcription: "Erreur technique.",
                    mistakes: []
                };
            }

            const rawText = await AIEngine.ask(promptParts, system);
            return AIEngine.sanitizeJSON(rawText);

        } catch (e) {
            return { 
                studentName: "Crash", 
                grade: "?", 
                appreciation: "Erreur critique.", 
                transcription: e.message, 
                mistakes: [] 
            };
        }
    }
};

module.exports = ScanAI;