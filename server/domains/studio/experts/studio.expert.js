const fs = require('fs');
const path = require('path');
const https = require('https');
const StudioAI = require('../ai/studio.ai');
const StudioDB = require('../db/studio.db');

/**
 * 🛠️ EXPERT STUDIO
 * Orchestre la création d'assets et la gestion de projets.
 */
const StudioExpert = {
    
    // Génère une image via IA et la sauvegarde localement
    generateAsset: async (userPrompt, type) => {
        // 1. Optimisation du prompt par Gemini
        const optimizedPrompt = await StudioAI.optimizeAssetPrompt(userPrompt, type);
        console.log(`🧠 [STUDIO-EXPERT] Prompt Final : ${optimizedPrompt}`);

        // 2. Préparation du téléchargement
        // Encodage propre pour l'URL
        const encodedPrompt = encodeURIComponent(optimizedPrompt);
        const seed = Math.floor(Math.random() * 10000);
        // URL Pollinations
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&seed=${seed}&nologo=true`;

        // 3. Sauvegarde Locale
        const fileName = `studio-${Date.now()}-${seed}.jpg`;
        // On s'assure que le chemin est absolu et correct
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        
        const outputPath = path.join(uploadDir, fileName);
        const file = fs.createWriteStream(outputPath);

        return new Promise((resolve, reject) => {
            https.get(imageUrl, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Pollinations Error: ${response.statusCode}`));
                    return;
                }
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve({
                        url: `/uploads/${fileName}`,
                        prompt: optimizedPrompt,
                        name: userPrompt.substring(0, 15)
                    });
                });
            }).on('error', (err) => {
                fs.unlink(outputPath, () => {}); // Nettoyage si erreur
                reject(err);
            });
        });
    },

    saveProject: async (projectData) => {
        return await StudioDB.upsertProject(projectData);
    },

    getUserProjects: async (userId) => {
        return await StudioDB.findProjectsByTeacher(userId);
    }
};

module.exports = StudioExpert;