const StructureDB = require('../db/structure.db');

// Expert minimaliste : pas de logique complexe, juste du passe-plat
const StructureExpert = {
    getChapters: async () => {
        return await StructureDB.getAllChapters();
    },
    createChapter: async (data) => {
        const cleanData = { ...data, title: data.title ? data.title.toUpperCase().trim() : "NOUVEAU CHAPITRE" };
        return await StructureDB.createChapter(cleanData);
    },
    deleteChapter: async (id) => {
        return await StructureDB.deleteChapter(id);
    }
};

module.exports = StructureExpert;