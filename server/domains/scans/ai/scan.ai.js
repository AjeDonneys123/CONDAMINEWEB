const AIEngine = require('../../../core/ai.engine');
const StructureDrive = require('../../structure/experts/structure.drive'); 

// Helper : Convertit un Stream en Buffer
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
        console.log("👁️ [SCAN-AI] Correction Expert V4 (Mode Survie)...");

        const rosterText = studentList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

        const system = `Tu es un professeur correcteur expert.
        
        TES OBJECTIFS :
        1. Identifie l'élève parmi : [${rosterText}]. (Si inconnu, mets "Inconnu").
        2. Corrige la copie en comparant au sujet.
        3. Donne une note sur 20.
        4. Donne une appréciation constructive.

        FORMAT DE RÉPONSE OBLIGATOIRE (JSON RAW) :
        {
            "studentName": "Nom Prénom",
            "transcription": "Résumé des points clés vus dans la copie...",
            "appreciation": "Ton avis global pour l'élève...",
            "grade": "15/20",
            "mistakes": ["Erreur 1", "Erreur 2"]
        }
        
        IMPORTANT : Ne mets PAS de Markdown. Juste le JSON.`;

        const promptParts = [
            { text: `INSTRUCTIONS PROF : ${instructions}` }
        ];

        // --- FONCTION : RÉCUPÉRATION STREAM DRIVE -> BUFFER ---
        const getImageData = async (url) => {
            try {
                if (url.includes('/proxy/')) {
                    const fileId = url.split('/proxy/')[1];
                    // console.log(`☁️ [AI-FETCH] Download ID: ${fileId}`);
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
            // 1. Sujets
            if (subjectUrls && subjectUrls.length > 0) {
                for (const url of subjectUrls) {
                    const b64 = await getImageData(url);
                    if (b64) {
                        promptParts.push({ inlineData: { mimeType: "image/jpeg", data: b64 } });
                        promptParts.push({ text: "[IMAGE ÉNONCÉ]" });
                    }
                }
            }

            // 2. Copie
            const copyB64 = await getImageData(copyUrl);
            if (copyB64) {
                promptParts.push({ inlineData: { mimeType: "image/jpeg", data: copyB64 } });
                promptParts.push({ text: "[IMAGE COPIE ÉLÈVE]" });
            } else {
                return {
                    studentName: "Image Illisible",
                    grade: "0/20",
                    appreciation: "Impossible de lire l'image depuis le Drive.",
                    transcription: "Erreur technique de téléchargement.",
                    mistakes: []
                };
            }

            // 3. Appel IA + Gestion Erreur Format
            const rawText = await AIEngine.ask(promptParts, system);
            
            try {
                return AIEngine.sanitizeJSON(rawText);
            } catch (jsonError) {
                console.warn("⚠️ [SCAN-AI] JSON invalide, passage en mode RAW TEXT.");
                // FALLBACK : On retourne le texte brut pour que le prof puisse quand même lire
                return {
                    studentName: "Nom à vérifier",
                    grade: "?/20",
                    appreciation: "⚠️ Format IA non-standard (voir détail)",
                    transcription: rawText.replace("PARSING_FAILED: ", ""), // On affiche toute la réponse de l'IA ici
                    mistakes: ["Erreur de formatage automatique"]
                };
            }

        } catch (e) {
            console.error("❌ Scan AI Fatal Error:", e.message);
            return { 
                studentName: "Erreur IA", 
                grade: "?", 
                appreciation: "Erreur critique : " + e.message, 
                transcription: "", 
                mistakes: [] 
            };
        }
    }
};

module.exports = ScanAI;