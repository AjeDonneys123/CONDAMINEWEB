const StructureDB = require('../db/structure.db');
const StructureDrive = require('./structure.drive');

const StructureExpert = {
    getChapters: async () => {
        return await StructureDB.getAllChapters();
    },
    createChapter: async (data) => {
        const cleanData = { ...data, title: data.title ? data.title.toUpperCase().trim() : "NOUVEAU CHAPITRE" };
        const newChapter = await StructureDB.createChapter(cleanData);
        
        // Déclenchement Asynchrone de la création Drive (Ne bloque pas l'UI)
        // Utilise l'intelligence du compte connecté (Pro ou Perso selon Refresh Token)
        StructureDrive.createFullHierarchy(newChapter._id).then(id => {
            if(id) console.log(`✨ Drive Sync OK pour ${newChapter.title}`);
        });
        
        return newChapter;
    },
    deleteChapter: async (id) => {
        return await StructureDB.deleteChapter(id);
    }
};

module.exports = StructureExpert;