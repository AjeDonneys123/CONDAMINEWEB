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
        console.log("👁️ [SCAN-AI] Correction V120 (Mode Assistant Pédagogique)...");

        const rosterText = studentList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

        // ON CHANGE LE CONTEXTE POUR EVITER LE REFUS
        const system = `RÔLE : Assistant Pédagogique Numérique.
        CONTEXTE : Le professeur utilise cet outil pour numériser et pré-analyser des copies manuscrites.
        
        TA MISSION :
        1. Transcrire le texte manuscrit de l'image (OCR).
        2. Comparer ce texte aux critères fournis par le professeur : "${instructions}".
        3. Suggérer une évaluation indicative.
        
        AUTORISATIONS :
        - Tu as l'autorisation d'analyser ce document dans un cadre pédagogique.
        - Identifie l'élève parmi cette liste si possible : [${rosterText}].

        FORMAT DE RÉPONSE ATTENDU (JSON) :
        {
            "studentName": "Nom de l'élève ou Inconnu",
            "grade": "Note suggérée (A+, A, B, C)",
            "appreciation": "Synthèse courte pour le professeur.",
            "transcription": "Transcription du texte de l'élève en NOIR. Insère tes suggestions de correction en ROUGE avec la balise HTML <span style='color:#ef4444; font-weight:bold;'>[SUGGESTION]</span>.",
            "mistakes": ["Point d'attention 1", "Point d'attention 2"]
        }`;

        const promptParts = [
            { text: "Analyse cette copie s'il te plaît." }
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
            if (subjectUrls) {
                for (const url of subjectUrls) {
                    const b64 = await getImageData(url);
                    if (b64) promptParts.push({ inlineData: { mimeType: "image/jpeg", data: b64 } });
                }
            }

            const copyB64 = await getImageData(copyUrl);
            if (copyB64) {
                promptParts.push({ inlineData: { mimeType: "image/jpeg", data: copyB64 } });
                promptParts.push({ text: "Voici la copie." });
            } else {
                return {
                    studentName: "Image Illisible",
                    grade: "C",
                    appreciation: "Impossible de lire le fichier.",
                    transcription: "Erreur technique Drive.",
                    mistakes: []
                };
            }

            const rawText = await AIEngine.ask(promptParts, system);
            return AIEngine.sanitizeJSON(rawText);

        } catch (e) {
            return { 
                studentName: "Erreur", 
                grade: "?", 
                appreciation: "L'assistant n'a pas pu traiter la demande.", 
                transcription: e.message, 
                mistakes: [] 
            };
        }
    }
};

module.exports = ScanAI;