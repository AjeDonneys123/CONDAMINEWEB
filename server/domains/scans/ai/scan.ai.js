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
        console.log("👁️ [SCAN-AI] Correction V145 (Prompt Monobloc)...");

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
        if (!copyB64) return { studentName: "Erreur", grade: "?", appreciation: "Image illisible.", transcription: "Le téléchargement a échoué.", mistakes: [] };

        // 1. OCR Google Vision
        let ocrText = await OCREngine.extractText(copyB64);
        let debugSource = "";
        let promptParts = [];

        // ON CONSTRUIT UN SEUL ENORME MESSAGE (Pas de System Instruction séparé)
        let bigPrompt = `
        CECI N'EST PAS UNE CONVERSATION. EXÉCUTE LA TÂCHE SUIVANTE IMMÉDIATEMENT.
        
        RÔLE : Correcteur Automatique.
        
        INPUT DONNÉ CI-DESSOUS (Texte OCR ou Image).
        
        CONSIGNE DE CORRECTION : "${instructions}"
        LISTE ÉLÈVES : [${rosterText}]

        FORMAT DE SORTIE JSON STRICTEMENT OBLIGATOIRE :
        {
            "studentName": "Nom trouvé ou Inconnu",
            "grade": "Note (A, B, C)",
            "appreciation": "Ton avis global en Français.",
            "transcription": "Recopie le texte de l'élève. Ajoute tes corrections en rouge avec <span style='color:#ef4444; font-weight:bold;'>[CORRECTION]</span>.",
            "mistakes": []
        }

        NE RÉPONDS PAS "JE SUIS PRÊT". DONNE LE JSON TOUT DE SUITE.
        `;

        if (ocrText && ocrText.length > 5) {
            console.log("✅ OCR OK. Injection Texte.");
            debugSource = "[SOURCE: OCR VISION API]";
            
            bigPrompt += `
            
            VOICI LE TEXTE À CORRIGER (Issu de l'OCR) :
            """
            ${ocrText}
            """
            
            GÉNÈRE LE JSON MAINTENANT.
            `;
            
            promptParts.push({ text: bigPrompt });

        } else {
            console.warn("⚠️ Fallback Vision.");
            debugSource = "[SOURCE: GEMINI VISION]";
            bigPrompt += `
            
            ANALYSE L'IMAGE JOINTE ET GÉNÈRE LE JSON.
            `;
            
            promptParts.push({ text: bigPrompt });
            promptParts.push({ inlineData: { mimeType: "image/jpeg", data: copyB64 } });
        }

        try {
            // On passe "undefined" en 2ème argument pour ne pas utiliser de System Instruction séparé
            const rawText = await AIEngine.ask(promptParts, undefined);
            const result = AIEngine.sanitizeJSON(rawText);

            if (!result.transcription || result.transcription.length < 5) {
                result.transcription = `⚠️ IA Muette.\n\n${debugSource}\n\nTexte brut OCR :\n${ocrText || "Aucun"}`;
            } else {
                 result.transcription = `${debugSource}\n\n${result.transcription}`;
            }

            return result;

        } catch (e) {
            return { 
                studentName: "Crash", 
                grade: "?", 
                appreciation: "Crash IA.", 
                transcription: `Erreur : ${e.message}`, 
                mistakes: [] 
            };
        }
    }
};

module.exports = ScanAI;