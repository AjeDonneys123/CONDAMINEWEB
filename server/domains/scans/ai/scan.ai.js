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
        console.log("👁️ [SCAN-AI] Correction V142 (Debug Vide)...");

        const rosterText = studentList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

        const getImageData = async (url) => {
            try {
                if (url.includes('/proxy/')) {
                    const fileId = url.split('/proxy/')[1];
                    const stream = await StructureDrive.getFileStream(fileId);
                    const buffer = await streamToBuffer(stream);
                    if (buffer.length < 100) throw new Error("Vide");
                    return buffer.toString('base64');
                }
                return null;
            } catch (e) { return null; }
        };

        const copyB64 = await getImageData(copyUrl);
        if (!copyB64) {
            return { studentName: "Erreur", grade: "?", appreciation: "Image illisible.", transcription: "Le téléchargement du Drive a échoué.", mistakes: [] };
        }

        // TENTATIVE OCR VISION API
        let ocrText = await OCREngine.extractText(copyB64);
        let debugSource = "";

        let promptParts = [];
        let systemContext = "";

        if (ocrText && ocrText.length > 10) {
            console.log("✅ OCR VISION SUCCESS");
            debugSource = "[SOURCE: GOOGLE VISION API]";
            
            systemContext = `Tu es un assistant correcteur.
            Voici le texte brut extrait d'une copie :
            """
            ${ocrText}
            """
            
            TA TÂCHE :
            1. Remets ce texte en forme (corrige les fautes de lecture OCR).
            2. Identifie l'élève : [${rosterText}].
            3. Ajoute tes corrections en rouge HTML : <span style='color:#ef4444; font-weight:bold;'>[CORRECTION]</span>.
            
            FORMAT JSON OBLIGATOIRE :
            {
                "studentName": "Nom",
                "grade": "Note",
                "appreciation": "Avis",
                "transcription": "Texte...",
                "mistakes": []
            }`;
            
            promptParts.push({ text: `CONSIGNE : ${instructions}` });

        } else {
            console.warn("⚠️ OCR VISION FAILED -> GEMINI VISION");
            debugSource = "[SOURCE: GEMINI VISION FALLBACK - OCR ECHOUÉ]";
            
            systemContext = `RÔLE : Machine de transcription OCR.
            TA MISSION :
            1. Transcris TOUT le texte visible sur cette image.
            2. Si tu ne peux pas lire, écris "ILLISIBLE".
            3. Ensuite, ajoute des corrections en rouge HTML.
            
            FORMAT JSON :
            {
                "studentName": "Nom",
                "grade": "Note",
                "appreciation": "Avis",
                "transcription": "Texte...",
                "mistakes": []
            }`;
            
            promptParts.push({ inlineData: { mimeType: "image/jpeg", data: copyB64 } });
        }

        try {
            const rawText = await AIEngine.ask(promptParts, systemContext);
            const result = AIEngine.sanitizeJSON(rawText);

            // --- V142 : DETECTION DE VIDE ---
            if (!result.transcription || result.transcription.length < 5 || result.transcription.includes("Pas de détail")) {
                console.error("❌ TRANSCRIPTION VIDE DETECTÉE");
                result.transcription = `⚠️ ECHEC TRANSCRIPTION\n\n${debugSource}\n\nL'IA a renvoyé un résultat vide. \n\nSi Google Vision était actif, voici le texte brut :\n${ocrText || "Aucun texte brut extrait."}`;
                result.appreciation = "Erreur de traitement (Voir détail).";
            } else {
                // On ajoute la source pour info
                result.transcription = `${debugSource}\n\n` + result.transcription;
            }

            return result;

        } catch (e) {
            return { 
                studentName: "Crash", 
                grade: "?", 
                appreciation: "Crash IA.", 
                transcription: `Erreur Technique : ${e.message}\n\n${debugSource}`, 
                mistakes: [] 
            };
        }
    }
};

module.exports = ScanAI;