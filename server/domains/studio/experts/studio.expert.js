// @signatures: codeToSave, StudioExpert
const fs = require('fs');
const path = require('path');
const https = require('https');
const StudioAI = require('../ai/studio.ai');
const GameGeneratorAI = require('../ai/game-generator.ai'); 
const StudioDB = require('../db/studio.db');
const StudioDrive = require('./studio.drive'); 

const StudioExpert = {
    generateAsset: async (userPrompt, type) => {
        const optimizedPrompt = await StudioAI.optimizeAssetPrompt(userPrompt, type);
        return await StudioExpert._downloadAndStore(optimizedPrompt, userPrompt);
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
                if (response.statusCode !== 200) { reject(new Error("Error")); return; }
                response.pipe(file);
                file.on('finish', async () => {
                    file.close();
                    const driveData = await StudioDrive.uploadAsset(localPath, fileName);
                    resolve({ url: `/api/structure/proxy/${driveData.id}`, name: originalName });
                });
            }).on('error', reject);
        });
    },

    generateGame: async (projectId, gameIdea) => {
        const project = await StudioDB.findProjectById(projectId);
        if (!project) throw new Error("ID Invalide");
        const allActors = project.scenes.flatMap(s => s.actors);
        const aiResult = await GameGeneratorAI.generateGameCode(gameIdea, allActors);
        project.generatedCode = aiResult.code;
        await StudioDB.upsertProject(project);
        return aiResult;
    },

    fixCode: async (code, userInstruction, projectId) => {
        const project = await StudioDB.findProjectById(projectId);
        if (!project) throw new Error("ID Invalide");
        const allActors = project.scenes.flatMap(s => s.actors);
        const aiResult = await GameGeneratorAI.fixGameCode(code, userInstruction, allActors);
        project.generatedCode = aiResult.code;
        await StudioDB.upsertProject(project);
        return aiResult;
    },

    saveProject: async (projectData) => await StudioDB.upsertProject(projectData),
    getUserProjects: async (userId) => await StudioDB.findProjectsByTeacher(userId)
};

module.exports = StudioExpert;
