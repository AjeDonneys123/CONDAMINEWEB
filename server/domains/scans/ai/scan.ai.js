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
        console.log("👁️ [SCAN-AI] Correction V132 (Français Forcé)...");

        const rosterText = studentList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

        // PROMPT ULTRA-DIRECTIF
        const system = `Tu es un automate de correction FRANÇAIS.
        
        RÈGLES ABSOLUES (Sous peine de dysfonctionnement) :
        1. LANGUE : TU DOIS RÉPONDRE EN FRANÇAIS UNIQUEMENT. JAMAIS D'ANGLAIS.
        2. FORMAT : Tu dois renvoyer STRICTEMENT l'objet JSON ci-dessous.
        3. CONTENU : Ne crée pas de sous-objets pour les questions. Mets toute la transcription dans un seul bloc de texte avec des sauts de ligne \\n.
        
        STRUCTURE JSON OBLIGATOIRE :
        {
            "studentName": "Nom trouvé (ou Inconnu)",
            "grade": "Note (A, B, C)",
            "appreciation": "Commentaire global en FRANÇAIS (2 phrases).",
            "transcription": "Recopie ici tout le texte de l'élève. Insère tes corrections en rouge avec : <span style='color:#ef4444; font-weight:bold;'>[CORRECTION]</span>.",
            "mistakes": ["Orthographe", "Grammaire", "Sens"]
        }
        
        Liste élèves : [${rosterText}].`;

        const promptParts = [
            { text: `SUJET/CONSIGNE : ${instructions}` }
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
                promptParts.push({ text: "CORRIGE CETTE COPIE EN FRANÇAIS." });
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