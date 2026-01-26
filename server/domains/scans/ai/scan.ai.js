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
        console.log("👁️ [SCAN-AI] Correction V126 (Le Retour du Prof)...");

        const rosterText = studentList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

        // ON REVIENT AU PROMPT PEDAGOGIQUE EFFICACE + INSTRUCTION DE FORMATAGE
        const system = `Tu es un Assistant Pédagogique Expert.
        
        TES OBJECTIFS :
        1. Identifier l'élève parmi : [${rosterText}].
        2. Transcrire le texte de l'élève (OCR) et insérer tes corrections directement dedans.
        3. Évaluer le travail selon : "${instructions}".
        
        FORMATAGE OBLIGATOIRE (HTML) :
        - Le texte de l'élève doit rester normal.
        - TES corrections/commentaires doivent être insérés là où il y a une faute, entourés de cette balise : 
          <span style="color:#ef4444; font-weight:bold;"> [TA CORRECTION] </span>
        - Exemple : "L'élève a écrit : Je mange <span style="color:#ef4444; font-weight:bold;">[manges -> mange]</span> une pomme."
        
        FORMAT DE SORTIE (JSON) :
        {
            "studentName": "Nom trouvé ou Inconnu",
            "grade": "Note (A+, A, B ou C)",
            "appreciation": "Ton avis global en 2 phrases.",
            "transcription": "Le texte complet de l'élève avec tes corrections en ROUGE insérées dedans.",
            "mistakes": ["Liste des fautes principales"]
        }
        
        IMPORTANT : Ne fais PAS de 'bounding box'. Fais de l'analyse de texte.`;

        const promptParts = [
            { text: "ANALYSE CETTE COPIE." }
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
                promptParts.push({ text: "Voici la copie de l'élève." });
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