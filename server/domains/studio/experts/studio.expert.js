// @signatures: StudioExpert, specializedBgRemoval, _getImageBuffer
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
        console.log("   Cible :", imageUrl);
        
        if (!apiKey) {
            console.error("❌ ERREUR : Clé REMOVE_BG_API_KEY absente du .env");
            return null;
        }

        try {
            // 1. Extraction ID Drive
            const fileId = imageUrl.split('/').pop();
            console.log("   ID Drive extrait :", fileId);

            // 2. Récupération du flux depuis Google Drive
            const stream = await ProfDrive.getFileStream(fileId);
            console.log("   Flux Drive récupéré.");
            
            // 3. Préparation FormData pour Remove.bg
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
                return null;
            }

            // 4. Réception du résultat
            const buffer = await response.buffer();
            console.log("   Image détourée reçue (Taille :", buffer.length, "octets)");

            // 5. Sauvegarde temporaire locale
            const fileName = `ai-cleaned-${Date.now()}.png`;
            const localPath = path.join(process.cwd(), 'public', 'uploads', fileName);
            fs.writeFileSync(localPath, buffer);

            // 6. Upload final vers Drive (Dossier Studio Assets)
            const driveData = await StudioDrive.uploadAsset(localPath, fileName);
            console.log("   Upload Drive réussi :", driveData.id);

            // Nettoyage
            try { fs.unlinkSync(localPath); } catch(e) {}

            console.log("✅ DÉTOURAGE TERMINÉ.");
            console.log("------------------------------------------------");
            return { url: `/api/proxy/${driveData.id}` };

        } catch (e) {
            console.error("💥 CRASH DÉTOURAGE :", e.message);
            return null;
        }
    },

    saveProject: async (projectData) => await StudioDB.upsertProject(projectData),
    getUserProjects: async (userId) => await StudioDB.findProjectsByTeacher(userId)
};

module.exports = StudioExpert;
