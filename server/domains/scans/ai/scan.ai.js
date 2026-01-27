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
        console.log("👁️ [SCAN-AI] Correction V143 (Action Immédiate)...");

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
        if (!copyB64) return { studentName: "Erreur", grade: "?", appreciation: "Image HS", transcription: "", mistakes: [] };

        // --- 1. LECTURE PAR GOOGLE VISION ---
        let ocrText = await OCREngine.extractText(copyB64);
        
        let promptParts = [];
        let systemContext = `Tu es un MOTEUR DE TRANSCRIPTION ET CORRECTION JSON.
        Ne parle pas. N'attends pas. Exécute.
        
        FORMAT JSON OBLIGATOIRE :
        {
            "studentName": "Nom identifié ou Inconnu",
            "grade": "Note (A, B, C)",
            "appreciation": "Commentaire.",
            "transcription": "Texte élève complet avec corrections en rouge <span style='color:#ef4444; font-weight:bold;'>[CORR]</span>.",
            "mistakes": []
        }
        
        Liste élèves connus : [${rosterText}].`;

        if (ocrText && ocrText.length > 10) {
            console.log("✅ OCR OK. Injection directe.");
            
            // ICI LE CHANGEMENT : On injecte le texte COMME UNE COMMANDE, pas comme un contexte.
            promptParts.push({ text: `
            VOICI LE TEXTE À CORRIGER MAINTENANT :
            """
            ${ocrText}
            """
            
            CONSIGNE DU PROFESSEUR : "${instructions}"
            
            ACTION :
            1. Nettoie ce texte (enlève les erreurs OCR).
            2. Corrige-le selon la consigne.
            3. Donne moi le JSON immédiatement.
            ` });

        } else {
            console.warn("⚠️ Fallback Vision.");
            promptParts.push({ inlineData: { mimeType: "image/jpeg", data: copyB64 } });
            promptParts.push({ text: `Lis cette image et corrige le devoir selon la consigne : "${instructions}". RENVOIE LE JSON.` });
        }

        try {
            const rawText = await AIEngine.ask(promptParts, systemContext);
            const result = AIEngine.sanitizeJSON(rawText);

            if ((!result.transcription || result.transcription.length < 5) && ocrText) {
                result.transcription = `[SOURCE: GOOGLE VISION - IA MUETTE]\n\n${ocrText.replace(/\n/g, '<br/>')}`;
            } else if (ocrText) {
                 result.transcription = `[SOURCE: GOOGLE VISION + CORRECTION IA]\n\n${result.transcription}`;
            }

            return result;

        } catch (e) {
            return { 
                studentName: "Crash", 
                grade: "?", 
                appreciation: "Crash IA.", 
                transcription: e.message, 
                mistakes: [] 
            };
        }
    }
};

module.exports = ScanAI;