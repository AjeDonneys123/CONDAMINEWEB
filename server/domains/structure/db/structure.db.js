const mongoose = require('mongoose');

/**
 * 💾 COUCHE DB STRUCTURE
 * Accès brut aux chapitres et dossiers.
 */
const StructureDB = {
    getAllChapters: async () => {
        try {
            // Suppression des populates sur des champs inexistants (subjectId, classId)
            // On ne garde que teacherId qui est présent dans le schéma
            return await mongoose.model('Chapter').find({})
                .populate('teacherId', 'firstName lastName')
                .sort({ createdAt: -1 })
                .lean();
        } catch (e) {
            console.error("❌ DB Structure Error:", e.message);
            return [];
        }
    },
    createChapter: async (data) => await mongoose.model('Chapter').create(data),
    deleteChapter: async (id) => await mongoose.model('Chapter').findByIdAndDelete(id)
};

module.exports = StructureDB;