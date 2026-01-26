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
        console.log("👁️ [SCAN-AI] Correction V118 (Mode Rouge/Noir & Notes)...");

        const rosterText = studentList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

        const system = `Tu es un professeur correcteur expert.
        
        BARÈME STRICT À UTILISER (Champ 'grade') :
        - A+ : Très bien (Excellent).
        - A : Le travail est satisfaisant.
        - B : Compétences en cours d'acquisition (bons éléments mais ensemble incomplet).
        - C : Ensemble insuffisant.
        
        INSTRUCTIONS DE FORMATAGE (Champ 'transcription') :
        - Tu dois transcrire ce que tu lis sur la copie en **NOIR** (texte normal).
        - Tu dois insérer tes corrections et commentaires en **ROUGE** en utilisant EXCLUSIVEMENT la balise : <span style="color:#ef4444; font-weight:bold;"> [TON COMMENTAIRE] </span>.
        - Exemple : "L'élève a écrit 'les chevals'. <span style="color:#ef4444; font-weight:bold;">[Attention au pluriel : chevaux]</span>."
        - Utilise des sauts de ligne <br/> pour aérer.
        
        FORMAT JSON OBLIGATOIRE :
        {
            "studentName": "Nom trouvé ou Inconnu",
            "grade": "A+, A, B ou C",
            "appreciation": "Synthèse globale (2 phrases).",
            "transcription": "Ton analyse avec le code couleur HTML (Noir = Élève, Rouge = Prof).",
            "mistakes": ["Liste erreurs majeures"]
        }`;

        const promptParts = [
            { text: `CONSIGNES SPÉCIFIQUES : ${instructions}` }
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
                console.error(`❌ [AI-FETCH] Erreur : ${e.message}`);
                return null;
            }
        };

        try {
            if (subjectUrls) {
                for (const url of subjectUrls) {
                    const b64 = await getImageData(url);
                    if (b64) promptParts.push({ inlineData: { mimeType: "image/jpeg", data: b64 } });
                }
            }

            const copyB64 = await getImageData(copyUrl);
            if (copyB64) {
                promptParts.push({ inlineData: { mimeType: "image/jpeg", data: copyB64 } });
                promptParts.push({ text: "CORRIGE EN APPLIQUANT LE CODE COULEUR." });
            } else {
                return {
                    studentName: "Image Illisible",
                    grade: "C",
                    appreciation: "Impossible de lire le fichier.",
                    transcription: "Erreur technique Drive.",
                    mistakes: []
                };
            }

            const rawText = await AIEngine.ask(promptParts, system);
            return AIEngine.sanitizeJSON(rawText);

        } catch (e) {
            return { 
                studentName: "Erreur", 
                grade: "?", 
                appreciation: "Erreur critique.", 
                transcription: e.message, 
                mistakes: [] 
            };
        }
    }
};

module.exports = ScanAI;