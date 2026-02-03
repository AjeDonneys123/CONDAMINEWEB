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
        console.log("👁️ [SCAN-AI] Correction V132 (Fusion Transcription/Correction)...");

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

        const ocrResult = await OCREngine.extractText(copyB64);
        
        // --- NOUVEAU SYSTÈME DE SCRIBE HYBRIDE ---
        const scribeSystem = `Tu es un PROFESSEUR CORRECTEUR. Ta mission est de retranscrire la copie de l'élève tout en y insérant tes corrections.
        
        RÈGLES DE RENDU (TRÈS IMPORTANT) :
        1. TRANSCRIPTION : Écris le texte original de l'élève en noir (texte brut).
        2. CORRECTIONS : Dès que tu vois une faute (orthographe, grammaire, syntaxe) ou une erreur de fond, entoure ta correction par <span class="ai-red-mark">...</span>.
        3. FUSION : Ne sépare pas la transcription et la correction. La correction doit être insérée immédiatement après l'erreur ou remplacer l'erreur si elle est illisible.
        4. APPRÉCIATION : Finis toujours par une courte appréciation globale.
        5. IDENTITÉ : Trouve le nom parmi cette liste : [${rosterText}].

        EXEMPLE DE SORTIE DANS LE CHAMP 'transcription' :
        "Le chat <span class="ai-red-mark">mange</span> (au lieu de manj) sa souris. C'était une <span class="ai-red-mark">belle</span> journée."

        FORMAT JSON REQUIS :
        {
            "studentName": "Nom",
            "grade": "A+, A, B ou C",
            "appreciation": "Ton avis global ici",
            "transcription": "LE TEXTE COMPLET AVEC LES BALISES HTML ROUGES"
        }`;

        const promptParts = [
            { text: `Consignes du prof : "${instructions}"` },
            { text: `OCR de base pour aide : "${ocrResult.success ? ocrResult.text : 'Non disponible'}"` },
            { inlineData: { mimeType: "image/jpeg", data: copyB64 } }
        ];

        try {
            const rawText = await AIEngine.ask(promptParts, scribeSystem);
            return AIEngine.sanitizeJSON(rawText);
        } catch (e) {
            return { studentName: "Erreur", grade: "?", appreciation: "Échec analyse", transcription: "Impossible de générer la correction." };
        }
    }
};

module.exports = ScanAI;
