const StructureDB = require('../db/structure.db');
const StructureDrive = require('./structure.drive');

/**
 * 🧠 EXPERT STRUCTURE
 * Normalisation totale pour garantir que le filtrage par section (Archives) fonctionne.
 */
const StructureExpert = {
    getChapters: async () => {
        const chapters = await StructureDB.getAllChapters();
        return chapters.map(c => ({
            ...c,
            _id: String(c._id),
            isArchived: c.isArchived === true, 
            // Normalisation CRUCIALE pour le filtrage par colonnes dans le front
            section: (c.section || "GÉNÉRAL").toUpperCase().trim(),
            classroom: c.classroom ? c.classroom.toUpperCase().trim() : ""
        }));
    },

    createChapter: async (data) => {
        const cleanData = { 
            ...data, 
            title: data.title ? data.title.toUpperCase().trim() : "NOUVEAU CHAPITRE",
            section: data.section ? data.section.toUpperCase().trim() : "GÉNÉRAL",
            classroom: data.classroom ? data.classroom.toUpperCase().trim() : "",
            isArchived: false 
        };

        const newChapter = await StructureDB.createChapter(cleanData);
        
        StructureDrive.createFullHierarchy(newChapter._id).then(id => {
            if(id) console.log(`✨ [DRIVE] Dossier synchronisé : ${cleanData.title}`);
        }).catch(err => console.error("❌ [DRIVE] Erreur :", err.message));
        
        return newChapter;
    },

    deleteChapter: async (id) => {
        return await StructureDB.deleteChapter(id);
    }
};

module.exports = StructureExpert;