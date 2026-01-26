const AIEngine = require('../../../core/ai.engine');
const fs = require('fs');
const path = require('path');

const ScanAI = {
    correctCopy: async (copyUrl, subjectUrls, instructions, studentList) => {
        console.log("👁️ [SCAN-AI] Correction Expert (Sujet + Copie)...");

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

        // HELPER POUR NETTOYER LE CHEMIN
        // Transforme "/uploads/image.jpg" en "uploads/image.jpg" pour que path.join fonctionne
        const getLocalPath = (url) => {
            const relativePath = url.startsWith('/') ? url.slice(1) : url;
            return path.join(process.cwd(), 'public', relativePath);
        };

        try {
            // 1. Ajout des Sujets
            if (subjectUrls && subjectUrls.length > 0) {
                subjectUrls.forEach(url => {
                    const sPath = getLocalPath(url);
                    if (fs.existsSync(sPath)) {
                        promptParts.push({ inlineData: { mimeType: "image/jpeg", data: fs.readFileSync(sPath).toString('base64') } });
                        promptParts.push({ text: "[IMAGE ÉNONCÉ]" });
                    } else {
                        console.warn("⚠️ Image sujet introuvable:", sPath);
                    }
                });
            }

            // 2. Ajout de la Copie
            const copyPath = getLocalPath(copyUrl);
            if (fs.existsSync(copyPath)) {
                promptParts.push({ inlineData: { mimeType: "image/jpeg", data: fs.readFileSync(copyPath).toString('base64') } });
                promptParts.push({ text: "[IMAGE COPIE ÉLÈVE]" });
            } else {
                throw new Error(`Fichier copie introuvable sur le disque : ${copyPath}`);
            }

            const raw = await AIEngine.ask(promptParts, system);
            return AIEngine.sanitizeJSON(raw);

        } catch (e) {
            console.error("❌ Scan AI Error:", e.message);
            return { 
                studentName: "Erreur Technique", 
                grade: "0/20", 
                appreciation: "Impossible de traiter le fichier image. (Erreur serveur)", 
                transcription: e.message, 
                mistakes: [] 
            };
        }
    }
};

module.exports = ScanAI;