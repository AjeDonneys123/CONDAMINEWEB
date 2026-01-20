const mongoose = require('mongoose');
const DriveEngine = require('../../../core/drive.engine');

/**
 * 🧠 EXPERT ADMIN - VERSION 81
 * Fonctions de maintenance et diagnostic système.
 */
const AdminExpert = {
    // Vérification de la connexion Google Drive
    checkDriveStatus: async () => {
        try {
            return await DriveEngine.testAuth();
        } catch (e) {
            return { ok: false, error: e.message };
        }
    },

    // Dump complet de la BDD pour le mouchard
    getFullDump: async () => {
        const models = [
            'AcademicYear', 'Admin', 'Classroom', 'Subject', 
            'Teacher', 'Student', 'Enrollment', 'Chapter', 
            'Homework', 'Submission'
        ];
        const dump = {};
        for (const m of models) {
            try {
                if (mongoose.models[m]) {
                    const collectionName = mongoose.models[m].collection.name;
                    dump[collectionName] = await mongoose.model(m).find({}).limit(500).lean();
                }
            } catch (e) { console.error(`Dump fail for ${m}`); }
        }
        return dump;
    }
};

module.exports = AdminExpert;