const AIEngine = require('../../../core/ai.engine');
const fs = require('fs');
const path = require('path');

const ScanAI = {
    correctCopy: async (copyUrl, subjectUrls, instructions, studentList) => {
        console.log("👁️ [SCAN-AI] Démarrage Correction Expert...");

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

        FORMAT JSON ATTENDU :
        {
            "studentName": "Nom Trouvé",
            "transcription": "...",
            "appreciation": "...",
            "grade": "15/20",
            "mistakes": []
        }`;

        const promptParts = [
            { text: `INSTRUCTIONS PROF : ${instructions}\n\nVoici d'abord l'énoncé, puis la copie.` }
        ];

        // --- FONCTION LIMIER (Cherche le fichier partout) ---
        const findFileOnDisk = (url) => {
            const cleanName = url.split('/').pop().split('?')[0]; // ex: scan-123.jpg
            
            // Liste des endroits probables où chercher
            const candidates = [
                path.join(process.cwd(), 'public', 'uploads', cleanName), // Standard
                path.join(process.cwd(), 'uploads', cleanName),           // Racine
                path.join('/tmp', cleanName),                             // Dossier tmp système
                path.join(process.cwd(), 'public', url)                   // Chemin complet relatif
            ];

            for (const p of candidates) {
                if (fs.existsSync(p)) {
                    console.log(`✅ [SCAN-AI] Fichier trouvé ici : ${p}`);
                    return p;
                }
            }
            
            console.error(`❌ [SCAN-AI] Fichier INTROUVABLE. J'ai cherché ici :`, candidates);
            return null;
        };

        try {
            // 1. Ajout des Sujets
            if (subjectUrls && subjectUrls.length > 0) {
                subjectUrls.forEach(url => {
                    const sPath = findFileOnDisk(url);
                    if (sPath) {
                        promptParts.push({ inlineData: { mimeType: "image/jpeg", data: fs.readFileSync(sPath).toString('base64') } });
                        promptParts.push({ text: "[IMAGE ÉNONCÉ]" });
                    } else {
                        console.warn("⚠️ Image sujet ignorée (non trouvée sur disque).");
                    }
                });
            }

            // 2. Ajout de la Copie
            const copyPath = findFileOnDisk(copyUrl);
            if (copyPath) {
                promptParts.push({ inlineData: { mimeType: "image/jpeg", data: fs.readFileSync(copyPath).toString('base64') } });
                promptParts.push({ text: "[IMAGE COPIE ÉLÈVE]" });
            } else {
                throw new Error(`Fichier copie introuvable sur le disque. Voir logs serveur.`);
            }

            // 3. Appel IA
            const raw = await AIEngine.ask(promptParts, system);
            return AIEngine.sanitizeJSON(raw);

        } catch (e) {
            console.error("❌ Scan AI Error:", e.message);
            return { 
                studentName: "Erreur Technique", 
                grade: "0/20", 
                appreciation: "Le serveur n'a pas réussi à lire l'image sur le disque dur.", 
                transcription: e.message, 
                mistakes: [] 
            };
        }
    }
};

module.exports = ScanAI;