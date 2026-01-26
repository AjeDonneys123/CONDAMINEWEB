const AIEngine = require('../../../core/ai.engine');
const StructureDrive = require('../../structure/experts/structure.drive'); 

const ScanAI = {
    correctCopy: async (copyUrl, subjectUrls, instructions, studentList) => {
        console.log("👁️ [SCAN-AI] Correction via Drive...");

        const rosterText = studentList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

        const system = `Tu es un professeur correcteur expert.
        
        INPUT :
        1. Une ou plusieurs images de l'ÉNONCÉ (SUJET).
        2. Une image de la COPIE de l'élève.
        
        TES OBJECTIFS :
        1. **ANALYSE SUJET** : Comprends d'abord ce qui était demandé.
        2. **IDENTIFICATION** : Trouve le nom de l'élève sur la copie parmi : [${rosterText}]. Si doute, dis "Inconnu".
        3. **CORRECTION** : Vérifie les réponses.
        4. **NOTE** : Attribue une note sur 20.

        FORMAT JSON ATTENDU (STRICTEMENT CE JSON, RIEN D'AUTRE) :
        {
            "studentName": "Nom Trouvé",
            "transcription": "Texte court résumé",
            "appreciation": "Ton avis pédagogique",
            "grade": "15/20",
            "mistakes": ["Erreur 1", "Erreur 2"]
        }`;

        const promptParts = [
            { text: `INSTRUCTIONS PROF : ${instructions}\n\nVoici d'abord l'énoncé, puis la copie.` }
        ];

        // --- FONCTION : RÉCUPÉRATION STREAM DRIVE -> BUFFER ---
        const getImageData = async (url) => {
            try {
                if (url.includes('/proxy/')) {
                    const fileId = url.split('/proxy/')[1];
                    console.log(`☁️ [AI-FETCH] Récupération Drive ID: ${fileId}`);
                    
                    // On utilise le stream de l'expert Structure
                    const stream = await StructureDrive.getFileStream(fileId);
                    
                    // Conversion Stream -> Buffer pour Gemini
                    const chunks = [];
                    for await (const chunk of stream) {
                        chunks.push(chunk);
                    }
                    const buffer = Buffer.concat(chunks);
                    
                    return buffer.toString('base64');
                }
                return null;
            } catch (e) {
                console.error(`❌ [AI-FETCH] Erreur lecture Drive : ${e.message}`);
                return null;
            }
        };

        try {
            // 1. Sujets (Drive Uniquement)
            if (subjectUrls && subjectUrls.length > 0) {
                for (const url of subjectUrls) {
                    const b64 = await getImageData(url);
                    if (b64) {
                        promptParts.push({ inlineData: { mimeType: "image/jpeg", data: b64 } });
                        promptParts.push({ text: "[IMAGE ÉNONCÉ]" });
                    }
                }
            }

            // 2. Copie (Drive Uniquement)
            const copyB64 = await getImageData(copyUrl);
            if (copyB64) {
                promptParts.push({ inlineData: { mimeType: "image/jpeg", data: copyB64 } });
                promptParts.push({ text: "[IMAGE COPIE ÉLÈVE]" });
            } else {
                // Si on n'a pas pu récupérer l'image (fichier supprimé ou erreur Drive)
                return {
                    studentName: "Image Illisible",
                    grade: "0/20",
                    appreciation: "Impossible d'accéder à l'image sur le Google Drive.",
                    transcription: "Erreur de chargement.",
                    mistakes: []
                };
            }

            // 3. Appel IA
            const raw = await AIEngine.ask(promptParts, system);
            return AIEngine.sanitizeJSON(raw);

        } catch (e) {
            console.error("❌ Scan AI Fatal Error:", e.message);
            return { 
                studentName: "Erreur IA", 
                grade: "?", 
                appreciation: "Erreur lors de l'analyse IA : " + e.message, 
                transcription: "", 
                mistakes: [] 
            };
        }
    }
};

module.exports = ScanAI;