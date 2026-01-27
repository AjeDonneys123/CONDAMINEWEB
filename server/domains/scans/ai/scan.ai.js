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
        console.log("👁️ [SCAN-AI] Correction V144 (Diagnostic)...");

        const rosterText = studentList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

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
            } catch (e) { return null; }
        };

        const copyB64 = await getImageData(copyUrl);
        if (!copyB64) return { studentName: "Erreur", grade: "?", appreciation: "Image non chargée.", transcription: "Echec téléchargement Drive.", mistakes: [] };

        // --- 1. APPEL OCR AVEC DIAGNOSTIC ---
        let ocrResult = await OCREngine.extractText(copyB64);
        let ocrText = "";
        let debugMessage = "";

        if (ocrResult.success) {
            ocrText = ocrResult.text;
            if (!ocrText) debugMessage = "⚠️ OCR: Image lue mais aucun texte détecté (Flou ?).";
            else debugMessage = "✅ OCR: Lecture réussie.";
        } else {
            // ERREUR CRITIQUE GOOGLE VISION
            debugMessage = `❌ ERREUR OCR GOOGLE: ${ocrResult.error}`;
        }

        // --- 2. CONSTRUCTION DU PROMPT ---
        let promptParts = [];
        let systemContext = "";

        if (ocrText && ocrText.length > 5) {
            // Mode Texte (Si OCR a marché)
            systemContext = `Tu es un professeur correcteur.
            RÉPOND EN FRANÇAIS.
            
            Voici le texte brut de l'élève (lu par OCR) :
            """
            ${ocrText}
            """
            
            TA TÂCHE :
            1. Nettoie ce texte (enlève les erreurs de l'OCR).
            2. Corrige le fond en insérant : <span style='color:#ef4444; font-weight:bold;'>[CORRECTION]</span>.
            3. Identifie l'élève : [${rosterText}].
            
            FORMAT JSON :
            {
                "studentName": "Nom",
                "grade": "Note (A,B,C)",
                "appreciation": "Avis",
                "transcription": "Texte corrigé...",
                "mistakes": []
            }`;
            promptParts.push({ text: `CONSIGNE : ${instructions}` });

        } else {
            // Mode Vision (Fallback)
            systemContext = `Tu es un professeur. 
            Lis cette image et corrige-la.
            FORMAT JSON :
            { "studentName": "...", "grade": "...", "appreciation": "...", "transcription": "...", "mistakes": [] }`;
            promptParts.push({ inlineData: { mimeType: "image/jpeg", data: copyB64 } });
        }

        try {
            const rawText = await AIEngine.ask(promptParts, systemContext);
            const result = AIEngine.sanitizeJSON(rawText);

            // INJECTION DU DIAGNOSTIC DANS LE RÉSULTAT
            if (!result.transcription || result.transcription.length < 10) {
                result.transcription = `⚠️ ECHEC IA\n\nDIAGNOSTIC TECHNIQUE :\n${debugMessage}\n\nSi le message ci-dessus indique une erreur d'API, activez 'Cloud Vision API' dans la console Google.\n\nContenu brut OCR (si dispo) :\n${ocrText || "Aucun."}`;
            }

            return result;

        } catch (e) {
            return { 
                studentName: "Crash", 
                grade: "?", 
                appreciation: "Crash complet.", 
                transcription: `Erreur IA : ${e.message}\n\nDIAGNOSTIC OCR : ${debugMessage}`, 
                mistakes: [] 
            };
        }
    }
};

module.exports = ScanAI;