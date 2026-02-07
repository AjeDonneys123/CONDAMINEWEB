// @signatures: EditionExpert, saveErasedImage
const fs = require('fs');
const path = require('path');
const StudioDrive = require('./studio.drive');

/**
 * 🛠️ EXPERT EDITION - STUDIO
 * Gère les transformations techniques des assets (Gomme, Filtres, etc.)
 */
const EditionExpert = {
    /**
     * Sauvegarde une image issue de la gomme manuelle vers le Drive
     */
    saveErasedImage: async (localPath, originalName) => {
        try {
            const fileName = `cleaned-${Date.now()}-${originalName}`;
            const driveData = await StudioDrive.uploadAsset(localPath, fileName);
            
            // Nettoyage local
            if (fs.existsSync(localPath)) {
                try { fs.unlinkSync(localPath); } catch(e) {}
            }

            return { url: `/api/proxy/${driveData.id}` };
        } catch (e) {
            console.error("❌ [EDITION-EXPERT] Erreur save:", e.message);
            throw e;
        }
    }
};

module.exports = EditionExpert;
