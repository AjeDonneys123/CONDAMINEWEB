const AIEngine = require('../../../core/ai.engine');
const StructureDrive = require('../../structure/experts/structure.drive'); // Pour lire le Drive
const fs = require('fs');
const path = require('path');

// Helper : Convertit un Stream (Drive) en Buffer (Mémoire)
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
        console.log("👁️ [SCAN-AI] Démarrage Correction (Mode Hybride Drive/Local)...");

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

        // --- FONCTION INTELLIGENTE : RÉCUPÉRATION IMAGE (Drive ou Local) ---
        const getImageData = async (url) => {
            try {
                // CAS 1 : C'est un lien Proxy Google Drive (/api/structure/proxy/FILE_ID)
                if (url.includes('/proxy/')) {
                    const fileId = url.split('/proxy/')[1];
                    console.log(`☁️ [SCAN-AI] Téléchargement depuis Drive ID: ${fileId}`);
                    const stream = await StructureDrive.getFileStream(fileId);
                    const buffer = await streamToBuffer(stream);
                    return buffer.toString('base64');
                }

                // CAS 2 : C'est un fichier local (/uploads/fichier.jpg)
                // On nettoie l'URL pour avoir le chemin disque
                const cleanName = url.split('/').pop().split('?')[0];
                
                const candidates = [
                    path.join(process.cwd(), 'public', 'uploads', cleanName),
                    path.join(process.cwd(), 'uploads', cleanName),
                    path.join('/tmp', cleanName)
                ];

                for (const p of candidates) {
                    if (fs.existsSync(p)) {
                        console.log(`💿 [SCAN-AI] Fichier local trouvé : ${p}`);
                        return fs.readFileSync(p).toString('base64');
                    }
                }
                
                throw new Error(`Fichier introuvable (Ni Drive, Ni Local) : ${url}`);

            } catch (e) {
                console.error(`❌ [SCAN-AI] Erreur lecture image : ${e.message}`);
                return null;
            }
        };

        try {
            // 1. Traitement des Sujets
            if (subjectUrls && subjectUrls.length > 0) {
                for (const url of subjectUrls) {
                    const b64 = await getImageData(url);
                    if (b64) {
                        promptParts.push({ inlineData: { mimeType: "image/jpeg", data: b64 } });
                        promptParts.push({ text: "[IMAGE ÉNONCÉ]" });
                    }
                }
            }

            // 2. Traitement de la Copie
            const copyB64 = await getImageData(copyUrl);
            if (copyB64) {
                promptParts.push({ inlineData: { mimeType: "image/jpeg", data: copyB64 } });
                promptParts.push({ text: "[IMAGE COPIE ÉLÈVE]" });
            } else {
                return {
                    studentName: "Erreur Image",
                    grade: "0/20",
                    appreciation: "L'image de la copie est inaccessible (supprimée du serveur ou lien cassé).",
                    transcription: "Impossible de lire le fichier.",
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