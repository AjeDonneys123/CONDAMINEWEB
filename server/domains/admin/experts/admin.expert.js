// @signatures: AdminExpert, checkDriveStatus, getFullDump
const mongoose = require('mongoose');
const DriveEngine = require('../../../core/drive.engine');

const AdminExpert = {
    // Vérification Drive
    checkDriveStatus: async () => {
        try {
            return await DriveEngine.testAuth();
        } catch (e) {
            const hasToken = !!process.env.GOOGLE_REFRESH_TOKEN;
            return { ok: hasToken, email: hasToken ? "Connecté (Drive)" : "Non configuré" };
        }
    },

    // Dump complet pour le visualiseur BDD
    getFullDump: async () => {
        const models = [
            'AcademicYear', 'Admin', 'Classroom', 'Subject', 
            'Teacher', 'Student', 'Enrollment', 'Chapter', 
            'Homework', 'Submission', 'GameLevel', 'GameProgress', 
            'ScanSession', 'StudioProject'
        ];
        
        const dump = {};
        
        for (const m of models) {
            try {
                if (mongoose.models[m]) {
                    const collectionName = mongoose.models[m].collection.name;
                    dump[collectionName] = await mongoose.model(m).find({}).limit(200).lean();
                }
            } catch (e) { }
        }
        return dump;
    }
};

module.exports = AdminExpert;
