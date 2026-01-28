// @signatures: getImageData, streamToBuffer
const AIEngine = require('../../../core/ai.engine');
const OCREngine = require('../../../core/ocr.engine'); 
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
        console.log("👁️ [SCAN-AI] Correction V167 (Double Passe Littérale)...");

        const rosterText = studentList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

        const getImageData = async (url) => {
            try {
                if (url.includes('/proxy/')) {
                    const fileId = url.split('/proxy/')[1];
                    const stream = await StructureDrive.getFileStream(fileId);
                    const buffer = await streamToBuffer(stream);
                    return buffer.toString('base64');
                }
                return null;
            } catch (e) { return null; }
        };

        const copyB64 = await getImageData(copyUrl);
        if (!copyB64) return { studentName: "Erreur", grade: "?", appreciation: "Image non chargée" };

        // ÉTAPE 1 : OCR GOOGLE VISION (Lecture brute des caractères)
        const ocrResult = await OCREngine.extractText(copyB64);
        
        // ÉTAPE 2 : PROMPT "ROBOT SCRIBE" (Zéro interprétation, Zéro correction)
        const scribeSystem = `Tu es un ROBOT SCRIBE dont l'unique fonction est de COPIER des caractères.
        
        TES RÈGLES DE FER :
        1. NE RAJOUTE JAMAIS DE MOTS : Si l'élève écrit "qu'une personne", n'écris PAS "qu'une personne vit".
        2. NE CORRIGE PAS LA GRAMMAIRE : Si la phrase est cassée ou incomplète, laisse-la cassée.
        3. RESPECTE L'ESPAGNOLISME : Si tu vois "foto" ou "nordes", écris "foto" ou "nordes".
        4. SOIS STUPIDE : Ne cherche pas à donner du sens. Si un mot est illisible mais ressemble à "qu'", écris "qu'".
        5. IDENTIFIE LE NOM : Parmi cette liste [${rosterText}].

        FORMAT DE RÉPONSE REQUIS (JSON) :
        {
            "studentName": "Nom identifié",
            "grade": "Note finale A+, A, B ou C",
            "appreciation": "Ton analyse pédagogique (ici tu peux parler normalement)",
            "transcription": "LE TEXTE COPIÉ MOT POUR MOT, SANS AUCUNE CORRECTION."
        }`;

        const promptParts = [
            { text: `Voici l'OCR brut pour t'aider à déchiffrer : "${ocrResult.success ? ocrResult.text : 'Indisponible'}"` },
            { text: "TRANSCRIRE LITTÉRALEMENT CETTE IMAGE :" },
            { inlineData: { mimeType: "image/jpeg", data: copyB64 } }
        ];

        try {
            // On utilise une température très basse (0.1) pour forcer la fidélité
            const rawText = await AIEngine.ask(promptParts, scribeSystem);
            const result = AIEngine.sanitizeJSON(rawText);

            result.transcription = `[MOTEUR : VISION API + GEMINI SCRIBE]\n\n` + (result.transcription || "");
            return result;

        } catch (e) {
            return { studentName: "Erreur", grade: "?", appreciation: "Échec Moteur", transcription: e.message };
        }
    }
};

module.exports = ScanAI;
