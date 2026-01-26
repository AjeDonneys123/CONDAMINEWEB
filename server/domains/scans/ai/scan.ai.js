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
        console.log("👁️ [SCAN-AI] Correction V117 (Prompt Anti-Liste)...");

        const rosterText = studentList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

        const system = `Tu es un professeur correcteur.
        
        ⚠️ RÈGLE ABSOLUE : TU DOIS RENVOYER UN OBJET JSON UNIQUE {...}, PAS UN TABLEAU [...].
        
        FORMAT CIBLE :
        {
            "studentName": "Nom trouvé ou Inconnu",
            "grade": "Note/20",
            "appreciation": "Synthèse globale en 2 phrases",
            "transcription": "Ici, tu mets tout le détail : analyse point par point, corrections, suggestions. Utilise des sauts de ligne \\n.",
            "mistakes": ["Liste des fautes majeures"]
        }
        
        Si tu veux faire une liste de points, mets-la SOUS FORME DE TEXTE dans le champ 'transcription', pas comme des objets séparés.`;

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
                console.error(`❌ [AI] Err Img : ${e.message}`);
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
                promptParts.push({ text: "CORRIGE CETTE COPIE." });
            } else {
                return {
                    studentName: "Perdu",
                    grade: "0",
                    appreciation: "Image inaccessible.",
                    transcription: "Erreur technique Drive.",
                    mistakes: []
                };
            }

            const rawText = await AIEngine.ask(promptParts, system);
            return AIEngine.sanitizeJSON(rawText);

        } catch (e) {
            return { 
                studentName: "Crash", 
                grade: "?", 
                appreciation: "Erreur code.", 
                transcription: e.message, 
                mistakes: [] 
            };
        }
    }
};

module.exports = ScanAI;