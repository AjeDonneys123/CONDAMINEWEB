// @signatures: StudioExpert, specializedBgRemoval, saveProject, getUserProjects
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');
const ProfDrive = require('../../../prof/core/drive.prof'); 
const StudioDrive = require('./studio.drive'); 
const StudioDB = require('../db/studio.db');

const StudioExpert = {
    // 🚀 DÉTOURAGE VIA API SPÉCIALISÉE REMOVE.BG
    specializedBgRemoval: async (imageUrl) => {
        const apiKey = process.env.REMOVE_BG_API_KEY;
        
        console.log("------------------------------------------------");
        console.log("🛡️ [STUDIO-EXPERT] DÉBUT DÉTOURAGE SPÉCIALISÉ");
        
        if (!apiKey) {
            console.error("❌ ERREUR : Clé REMOVE_BG_API_KEY absente du .env");
            // On renvoie une erreur propre au lieu de planter
            throw new Error("Clé API Remove.bg manquante. Configurez le fichier .env");
        }

        try {
            const fileId = imageUrl.split('/').pop();
            console.log("   Cible ID:", fileId);

            const stream = await ProfDrive.getFileStream(fileId);
            
            const formData = new FormData();
            formData.append('size', 'auto');
            formData.append('image_file', stream);

            console.log("   Envoi vers Remove.bg...");
            const response = await fetch('https://api.remove.bg/v1.0/removebg', {
                method: 'POST',
                headers: { 'X-Api-Key': apiKey },
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("❌ ERREUR API Remove.bg :", response.status, errorText);
                throw new Error(`Remove.bg Refus: ${response.status} - ${errorText}`);
            }

            const buffer = await response.buffer();

            // SÉCURITÉ : CRÉATION DU DOSSIER TEMP SI INEXISTANT
            const tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const fileName = `ai-cleaned-${Date.now()}.png`;
            const localPath = path.join(tempDir, fileName);
            
            fs.writeFileSync(localPath, buffer);

            const driveData = await StudioDrive.uploadAsset(localPath, fileName);
            console.log("   Upload Drive réussi :", driveData.id);

            try { fs.unlinkSync(localPath); } catch(e) {}

            return { url: `/api/proxy/${driveData.id}` };

        } catch (e) {
            console.error("💥 CRASH DÉTOURAGE :", e.message);
            throw e; // On propage l'erreur pour que le front l'affiche
        }
    },

    saveProject: async (projectData) => await StudioDB.upsertProject(projectData),
    getUserProjects: async (userId) => await StudioDB.findProjectsByTeacher(userId)
};

module.exports = StudioExpert;
