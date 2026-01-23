const mongoose = require('mongoose');

/**
 * 💾 COUCHE DB STUDIO
 * Accès aux projets de théâtre/jeux.
 */
const StudioDB = {
    // Créer ou mettre à jour un projet
    upsertProject: async (data) => {
        const Model = mongoose.model('StudioProject');
        if (data._id) {
            return await Model.findByIdAndUpdate(data._id, data, { new: true });
        }
        return await Model.create(data);
    },

    // Récupérer les projets d'un prof
    findProjectsByTeacher: async (teacherId) => {
        return await mongoose.model('StudioProject').find({ teacherId }).sort({ updatedAt: -1 }).lean();
    },

    // Récupérer un projet précis
    findProjectById: async (id) => {
        return await mongoose.model('StudioProject').findById(id).lean();
    },

    deleteProject: async (id) => {
        return await mongoose.model('StudioProject').findByIdAndDelete(id);
    }
};

module.exports = StudioDB;