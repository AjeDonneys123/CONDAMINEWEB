const fs = require('fs');
const path = require('path');
const https = require('https');
const StudioAI = require('../ai/studio.ai');
const GameGeneratorAI = require('../ai/game-generator.ai'); 
const StudioDB = require('../db/studio.db');
const StudioDrive = require('./studio.drive'); 

/**
 * 🛠️ EXPERT STUDIO (V2.2 - FIX GENERATION)
 * Gère correctement le format Code + Message de l'IA.
 */
const StudioExpert = {
    
    generateAsset: async (userPrompt, type) => {
        const optimizedPrompt = await StudioAI.optimizeAssetPrompt(userPrompt, type);
        return await StudioExpert._downloadAndStore(optimizedPrompt, userPrompt);
    },

    remixAsset: async (file) => {
        const buffer = fs.readFileSync(file.path);
        const promptFromImage = await GameGeneratorAI.remixAssetDescription(buffer);
        return await StudioExpert._downloadAndStore(promptFromImage, "Remix IA");
    },

    _downloadAndStore: async (prompt, originalName) => {
        const encodedPrompt = encodeURIComponent(prompt);
        const seed = Math.floor(Math.random() * 10000);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&seed=${seed}&nologo=true`;

        const fileName = `studio-${Date.now()}-${seed}.png`;
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        const localPath = path.join(uploadDir, fileName);
        const file = fs.createWriteStream(localPath);

        return new Promise((resolve, reject) => {
            https.get(imageUrl, (response) => {
                if (response.statusCode !== 200) { reject(new Error(`Pollinations Error: ${response.statusCode}`)); return; }
                response.pipe(file);
                file.on('finish', async () => {
                    file.close();
                    let driveLink = null;
                    try {
                        const driveData = await StudioDrive.uploadAsset(localPath, fileName);
                        if (driveData) driveLink = driveData.link;
                    } catch(e) { console.error("Drive upload failed but local is ok"); }

                    resolve({
                        url: `/uploads/${fileName}`,
                        driveUrl: driveLink,
                        prompt: prompt,
                        name: originalName.substring(0, 15)
                    });
                });
            }).on('error', reject);
        });
    },

    generateGame: async (projectId, gameIdea) => {
        const project = await StudioDB.findProjectById(projectId);
        if (!project) throw new Error("Projet introuvable (ID Invalide)");

        let allActors = [];
        if (project.scenes && Array.isArray(project.scenes)) {
            project.scenes.forEach(s => {
                if (s.actors && Array.isArray(s.actors)) {
                    allActors.push(...s.actors);
                }
            });
        }

        if (allActors.length === 0) throw new Error("Aucun acteur trouvé dans ce projet. Ajoutez des personnages.");

        // L'IA renvoie maintenant : { code: "...", message: "..." }
        const aiResult = await GameGeneratorAI.generateGameCode(gameIdea, allActors);
        
        // CORRECTION CRITIQUE : On ne sauvegarde QUE le code (String) en BDD
        // Si aiResult est un objet (nouveau format), on prend .code
        // Sinon (format legacy ou erreur), on prend tel quel ou chaine vide
        const codeToSave = (typeof aiResult === 'object' && aiResult.code) ? aiResult.code : "";
        
        project.generatedCode = codeToSave;
        await StudioDB.upsertProject(project);
        
        // Mais on renvoie l'objet complet au Client pour avoir le message
        return aiResult;
    },

    saveProject: async (projectData) => await StudioDB.upsertProject(projectData),
    getUserProjects: async (userId) => await StudioDB.findProjectsByTeacher(userId)
};

module.exports = StudioExpert;