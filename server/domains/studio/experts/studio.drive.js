const DriveEngine = require('../../../core/drive.engine');

const STUDIO_FOLDER_NAME = "CONDA_STUDIO_ASSETS";

/**
 * 🎨 EXPERT DRIVE STUDIO
 * Gère le stockage propre des assets de jeu sur le Drive.
 */
const StudioDrive = {
    
    getStudioRoot: async () => {
        return await DriveEngine.getOrCreateFolder(STUDIO_FOLDER_NAME);
    },

    uploadAsset: async (localPath, filename) => {
        try {
            const rootId = await StudioDrive.getStudioRoot();
            // On upload le fichier
            const fileData = await DriveEngine.uploadFile(filename, localPath, rootId);
            return fileData; // { id, link }
        } catch (e) {
            console.error("Studio Drive Upload Error:", e);
            return null;
        }
    }
};

module.exports = StudioDrive;