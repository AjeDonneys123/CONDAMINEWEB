// @signatures: SaveLoadExpert
const StudioDB = require('../db/studio.db');

/**
 * 💾 EXPERT SAVE-LOAD STUDIO
 * Miroir Backend pour la gestion des sauvegardes et chargements.
 */
const SaveLoadExpert = {
    
    /**
     * Liste légère des projets pour la modale
     */
    listProjects: async (teacherId) => {
        return await StudioDB.findProjectsByTeacher(teacherId);
    },

    /**
     * Sauvegarde ou mise à jour
     */
    saveProject: async (projectData) => {
        if (!projectData.title) throw new Error("Le titre du projet est obligatoire.");
        if (!projectData.teacherId) throw new Error("Propriétaire manquant.");
        
        return await StudioDB.upsertProject(projectData);
    }
};

module.exports = SaveLoadExpert;
