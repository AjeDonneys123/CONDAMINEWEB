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
        console.log("👁️ [SCAN-AI] Correction V115 (Prompt Militaire)...");

        // On nettoie la liste des élèves pour économiser des tokens et éviter la confusion
        const rosterText = studentList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

        const system = `Tu es un robot d'analyse de données JSON. Tu n'es PAS un assistant conversationnel.
        
        TA TÂCHE :
        1. Analyser les images fournies (Sujet + Copie).
        2. Identifier l'élève si son nom est écrit sur la copie, parmi cette liste : [${rosterText}].
        3. Évaluer le travail selon les consignes : "${instructions}".
        
        RÈGLES DE SORTIE (STRICTES) :
        - TU NE DOIS PAS ÉCRIRE DE TEXTE EN DEHORS DU JSON.
        - Pas de "Voici l'analyse", pas de Markdown, pas de gras.
        - Uniquement un objet JSON valide.
        
        STRUCTURE JSON OBLIGATOIRE :
        {
            "studentName": "Nom Prénom (ou 'Inconnu')",
            "grade": "Note/20 (ex: 12/20)",
            "appreciation": "Court résumé global (2 phrases max)",
            "transcription": "Analyse détaillée, points forts et faibles. Tu peux utiliser des retours à la ligne \\n mais pas de Markdown complexe.",
            "mistakes": ["Erreur majeure 1", "Erreur majeure 2"]
        }`;

        const promptParts = [
            { text: "GÉNÈRE LE JSON MAINTENANT." }
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
                console.error(`❌ [AI] Erreur image: ${e.message}`);
                return null;
            }
        };

        try {
            // Sujets
            if (subjectUrls) {
                for (const url of subjectUrls) {
                    const b64 = await getImageData(url);
                    if (b64) {
                        promptParts.push({ inlineData: { mimeType: "image/jpeg", data: b64 } });
                        promptParts.push({ text: "CONTEXTE : IMAGE DU SUJET/CONSIGNE" });
                    }
                }
            }

            // Copie
            const copyB64 = await getImageData(copyUrl);
            if (copyB64) {
                promptParts.push({ inlineData: { mimeType: "image/jpeg", data: copyB64 } });
                promptParts.push({ text: "CIBLE : IMAGE DE LA COPIE À CORRIGER" });
            } else {
                return {
                    studentName: "Image Illisible",
                    grade: "0/20",
                    appreciation: "Impossible de lire le fichier depuis le Drive.",
                    transcription: "Erreur technique.",
                    mistakes: []
                };
            }

            // Appel IA
            const rawText = await AIEngine.ask(promptParts, system);
            
            // Le moteur V12 nettoiera le JSON s'il y a encore des résidus
            return AIEngine.sanitizeJSON(rawText);

        } catch (e) {
            return { 
                studentName: "Erreur Système", 
                grade: "?", 
                appreciation: "Erreur interne code : " + e.message, 
                transcription: "", 
                mistakes: [] 
            };
        }
    }
};

module.exports = ScanAI;