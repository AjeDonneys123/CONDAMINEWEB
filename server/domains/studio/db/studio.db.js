const mongoose = require('mongoose');

/**
 * 💾 COUCHE DB STUDIO - V485 (DEEP OVERWRITE STRATEGY)
 */
const StudioDB = {
    // Upsert qui écrase totalement les tableaux pour éviter les "sons fantômes"
    upsertProject: async (data) => {
        const Model = mongoose.model('StudioProject');
        const cleanData = { ...data };
        
        if (!cleanData._id || cleanData._id === 'null' || cleanData._id === 'undefined') {
            delete cleanData._id;
            return await Model.create(cleanData);
        }

        try {
            // --- STRATÉGIE DE REPLACEMENT ABSOLU ---
            const doc = await Model.findById(cleanData._id);
            if (!doc) {
                delete cleanData._id;
                return await Model.create(cleanData);
            }
            
            // On utilise .set() pour remplacer les données
            doc.set(cleanData);
            
            // SÉCURITÉ CODE CONSOLE : On force l'assignation explicite
            if (cleanData.generatedCode !== undefined) {
                doc.generatedCode = cleanData.generatedCode;
            }
            
            // On force Mongoose à marquer les champs complexes comme modifiés
            doc.markModified('scenes');
            doc.markModified('generatedCode');
            
            return await doc.save();
        } catch (e) {
            console.error("❌ DB Studio Deep Upsert Error:", e.message);
            throw e;
        }
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
