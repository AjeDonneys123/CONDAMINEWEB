const mongoose = require('mongoose');

/**
 * 💾 COUCHE DB STUDIO
 * Accès aux projets de théâtre/jeux.
 */
const StudioDB = {
    // Créer ou mettre à jour un projet (UPSERT ROBUSTE)
    upsertProject: async (data) => {
        const Model = mongoose.model('StudioProject');
        
        // 1. Nettoyage de l'objet pour éviter les injections d'ID null
        const cleanData = { ...data };
        if (!cleanData._id || cleanData._id === 'null' || cleanData._id === '') {
            delete cleanData._id;
        }

        // 2. Tentative de mise à jour SI on a un ID valide
        if (cleanData._id && mongoose.Types.ObjectId.isValid(cleanData._id)) {
            const updated = await Model.findByIdAndUpdate(cleanData._id, cleanData, { new: true });
            // SI trouvé et mis à jour, on le renvoie
            if (updated) return updated;
            
            // SINON (ID introuvable en base), on le supprime pour forcer une création propre
            delete cleanData._id;
        }
        
        // 3. Création (Si pas d'ID ou ID introuvable)
        return await Model.create(cleanData);
    },

    findProjectsByTeacher: async (teacherId) => {
        return await mongoose.model('StudioProject').find({ teacherId }).sort({ updatedAt: -1 }).lean();
    },

    findProjectById: async (id) => {
        if (!mongoose.Types.ObjectId.isValid(id)) return null;
        return await mongoose.model('StudioProject').findById(id).lean();
    },

    deleteProject: async (id) => {
        return await mongoose.model('StudioProject').findByIdAndDelete(id);
    }
};

module.exports = StudioDB;