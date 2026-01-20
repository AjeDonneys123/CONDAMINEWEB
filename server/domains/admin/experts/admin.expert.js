const AIEngine = require('../../../core/ai.engine');
const mongoose = require('mongoose');

/**
 * 🧠 EXPERT ADMIN - VERSION 46
 * Préparation de la logique d'importation massive (CSV).
 */
const AdminExpert = {
    // ANALYSE IA DU CSV (Prêt pour le prompt futur)
    analyzeImportData: async (payload) => {
        const system = "Tu es un expert en structures scolaires. Extrais les élèves, leur classe (2C, 2D) et leurs options (SPE HG, SES...).";
        const prompt = `Analyse ce CSV et renvoie un JSON structuré avec : 
        1. Liste des classes uniques.
        2. Liste des options/groupes uniques.
        3. Liste des élèves avec mapping vers leur classe ET leurs options.
        DONNÉES : ${payload.text}`;
        
        const raw = await AIEngine.ask(prompt, system);
        return AIEngine.sanitizeJSON(raw);
    },

    getFullDump: async () => {
        const models = ['AcademicYear', 'Admin', 'Classroom', 'Subject', 'Teacher', 'Student', 'Enrollment', 'Chapter', 'Homework', 'Submission'];
        const dump = {};
        for (const m of models) {
            if (mongoose.models[m]) {
                dump[mongoose.models[m].collection.name] = await mongoose.model(m).find({}).limit(500).lean();
            }
        }
        return dump;
    },

    checkDriveStatus: async () => {
        const DriveEngine = require('../../../core/drive.engine');
        return await DriveEngine.testAuth();
    }
};

module.exports = AdminExpert;