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
        console.log("👁️ [SCAN-AI] Correction V128 (Ciblage Élève Uniquement)...");

        const rosterText = studentList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

        const system = `RÔLE : Correcteur de copies scolaires.
        
        INSTRUCTION CRITIQUE :
        Tu vas recevoir des images de "SUJET" (le manuel) et une image de "COPIE ÉLÈVE" (manuscrite).
        --> NE TRANSCIS PAS LE SUJET ! IGNORE LE TEXTE DU SUJET DANS LA SORTIE.
        --> CONCENTRE-TOI UNIQUEMENT SUR LA COPIE MANUSCRITE DE L'ÉLÈVE.
        
        TA MISSION SUR LA COPIE ÉLÈVE :
        1. Recopie le texte de l'élève tel quel (en Noir).
        2. Si tu vois une faute (orthographe, sens, grammaire), insère une correction juste après en ROUGE.
           Format HTML OBLIGATOIRE : <span style="color:#ef4444; font-weight:bold;"> [CORRECTION] </span>
        3. Note la copie (A, B, C) selon la qualité des réponses par rapport au sujet.

        RÈGLES DE SORTIE JSON (INTERDICTION DE PARLER AVANT OU APRÈS) :
        {
            "studentName": "Nom trouvé sur la COPIE (ou Inconnu)",
            "grade": "Note (A, B, C)",
            "appreciation": "Commentaire général sur le travail de l'élève.",
            "transcription": "Le texte de l'élève avec tes corrections rouges insérées.",
            "mistakes": ["Liste des erreurs principales"]
        }
        
        Identifie l'élève parmi : [${rosterText}].`;

        const promptParts = [
            { text: `CONSIGNES DE CORRECTION : ${instructions}` }
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
            // 1. Envoi des Sujets avec étiquette CLAIRE
            if (subjectUrls) {
                for (const url of subjectUrls) {
                    const b64 = await getImageData(url);
                    if (b64) {
                        promptParts.push({ text: "IMAGE CONTEXTE (SUJET DU LIVRE) - NE PAS TRANSCRIRE CE TEXTE :" });
                        promptParts.push({ inlineData: { mimeType: "image/jpeg", data: b64 } });
                    }
                }
            }

            // 2. Envoi de la Copie avec étiquette CIBLE
            const copyB64 = await getImageData(copyUrl);
            if (copyB64) {
                promptParts.push({ text: "IMAGE CIBLE (COPIE DE L'ÉLÈVE) - À TRANSCRIRE ET CORRIGER :" });
                promptParts.push({ inlineData: { mimeType: "image/jpeg", data: copyB64 } });
                promptParts.push({ text: "GÉNÈRE LE JSON DE CORRECTION MAINTENANT." });
            } else {
                return {
                    studentName: "Erreur",
                    grade: "C",
                    appreciation: "Image copie illisible.",
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
                appreciation: "Crash IA.", 
                transcription: e.message, 
                mistakes: [] 
            };
        }
    }
};

module.exports = ScanAI;