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
        
        // Nettoyage ID principal
        if (!cleanData._id || cleanData._id === 'null' || cleanData._id === 'undefined') {
            delete cleanData._id;
        }

        // NETTOYAGE DES SCÈNES (CÔTÉ SERVEUR AUSSI)
        if (cleanData.scenes && Array.isArray(cleanData.scenes)) {
            cleanData.scenes = cleanData.scenes.map(s => {
                // Si l'ID n'est pas valide (pas un ObjectId), on le supprime pour que Mongoose en génère un nouveau
                if (s._id && !mongoose.Types.ObjectId.isValid(s._id)) {
                    delete s._id;
                }
                return s;
            });
        }

        // 2. Tentative de mise à jour SI on a un ID valide
        if (cleanData._id && mongoose.Types.ObjectId.isValid(cleanData._id)) {
            const updated = await Model.findByIdAndUpdate(cleanData._id, cleanData, { new: true });
            if (updated) return updated;
            
            // SINON (ID introuvable), on le supprime pour forcer une création
            delete cleanData._id;
        }
        
        // 3. Création
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
