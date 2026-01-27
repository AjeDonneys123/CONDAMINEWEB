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
        console.log("👁️ [SCAN-AI] Correction V141 (Sécurité Transcription)...");

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
            return { studentName: "Erreur", grade: "?", appreciation: "Image illisible.", transcription: "", mistakes: [] };
        }

        // --- 1. LECTURE PAR GOOGLE VISION ---
        let ocrText = await OCREngine.extractText(copyB64);
        
        let promptParts = [];
        let systemContext = "";

        if (ocrText !== null) {
            console.log("📝 [SCAN-AI] OCR Réussi (Taille: " + ocrText.length + " chars)");
            
            systemContext = `Tu es un professeur correcteur scrupuleux.
            
            DONNÉES :
            J'ai utilisé un scanner OCR pour extraire le texte brut de l'image. Le voici :
            """
            ${ocrText}
            """
            
            TA TÂCHE PRINCIPALE (TRANSCRIPTION) :
            1. RECOPIE INTÉGRALEMENT ce texte brut dans le champ 'transcription'.
            2. Corrige uniquement les fautes de lecture de l'OCR (ex: 'l' au lieu de '1').
            3. Insère tes corrections PÉDAGOGIQUES en rouge : <span style='color:#ef4444; font-weight:bold;'>[CORRECTION]</span>.
            
            TA TÂCHE SECONDAIRE (ÉVALUATION) :
            4. Identifie l'élève : [${rosterText}].
            5. Note (A-C) et commente.
            
            FORMAT JSON OBLIGATOIRE :
            {
                "studentName": "Nom",
                "grade": "Note",
                "appreciation": "Avis",
                "transcription": "LE TEXTE COMPLET DE L'ÉLÈVE + TES CORRECTIONS.",
                "mistakes": []
            }`;

            promptParts.push({ text: `CONSIGNE DU DEVOIR : "${instructions}"\n\nGÉNÈRE LE JSON MAINTENANT.` });

        } else {
            console.warn("⚠️ [SCAN-AI] Fallback Vision (OCR échoué).");
            systemContext = `Tu es un professeur. 
            IMPORTANT : Dans le champ 'transcription', tu DOIS recopier tout le texte que tu lis sur l'image. Ne fais pas de résumé.
            
            FORMAT JSON OBLIGATOIRE :
            { "studentName": "...", "grade": "...", "appreciation": "...", "transcription": "TEXTE COMPLET...", "mistakes": [] }`;
            
            promptParts.push({ inlineData: { mimeType: "image/jpeg", data: copyB64 } });
            promptParts.push({ text: `CONSIGNE : ${instructions}` });
        }

        try {
            const rawText = await AIEngine.ask(promptParts, systemContext);
            const result = AIEngine.sanitizeJSON(rawText);

            // --- FILET DE SÉCURITÉ V141 ---
            // Si l'IA a la flemme et renvoie une transcription vide ou trop courte,
            // on remplace par le texte brut de l'OCR. Mieux vaut du texte brut que rien.
            if ((!result.transcription || result.transcription.length < 10) && ocrText) {
                console.warn("⚠️ [SCAN-AI] Transcription IA vide. Injection du texte OCR brut.");
                result.transcription = "⚠️ (Mode Brut OCR) :\n\n" + ocrText.replace(/\n/g, '<br/>');
                if (!result.appreciation || result.appreciation === "Pas d'avis.") {
                    result.appreciation = "L'IA n'a pas réussi à structurer la correction, mais le texte a été lu.";
                }
            }

            return result;

        } catch (e) {
            return { 
                studentName: "Erreur", 
                grade: "?", 
                appreciation: "Crash IA.", 
                transcription: "Erreur technique : " + e.message, 
                mistakes: [] 
            };
        }
    }
};

module.exports = ScanAI;