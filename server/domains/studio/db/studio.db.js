const mongoose = require('mongoose');

/**
 * 💾 COUCHE DB STUDIO - V480 (REPLACEMENT SECURE)
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

        // --- STRATÉGIE DE REPLACEMENT ABSOLU ---
        try {
            const doc = await Model.findById(cleanData._id);
            if (!doc) {
                delete cleanData._id;
                return await Model.create(cleanData);
            }
            
            // On écrase les champs
            doc.set(cleanData);
            
            // On force Mongoose à voir que les scènes (contenant les sons) ont changé
            doc.markModified('scenes');
            
            return await doc.save();
        } catch (e) {
            console.error("❌ DB Studio Upsert Error:", e.message);
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
