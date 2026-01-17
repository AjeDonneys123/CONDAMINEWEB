const mongoose = require('mongoose');

// Couche BDD simple et robuste
const StructureDB = {
    getAllChapters: async () => {
        try {
            // On utilise .lean() pour éviter les problèmes de mémoire
            // On retire les populate complexes temporairement si besoin, mais on les garde pour l'instant
            return await mongoose.model('Chapter').find({})
                .populate('subjectId')
                .populate('classId')
                .sort({ createdAt: -1 })
                .lean();
        } catch (e) {
            console.error("DB Error (Chapters):", e.message);
            return []; // En cas d'erreur, on renvoie une liste vide pour ne pas crasher
        }
    },
    createChapter: async (data) => await mongoose.model('Chapter').create(data),
    deleteChapter: async (id) => await mongoose.model('Chapter').findByIdAndDelete(id)
};

module.exports = StructureDB;