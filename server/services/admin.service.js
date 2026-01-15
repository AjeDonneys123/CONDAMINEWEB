const mongoose = require('mongoose');

/**
 * ⚙️ SERVICE : ADMINISTRATION (SCELLÉ)
 * Mission : Exécuter les purges et sauvegardes de configuration.
 */
const AdminService = {
    getAllPlayers: async () => {
        const Player = mongoose.models.Player || mongoose.model('Player');
        return await Player.find({}).sort({ classroom: 1, lastName: 1 }).lean();
    },

    deleteClassroom: async (className) => {
        // US#15 : Nettoyage atomique multi-collections
        await mongoose.model('Player').deleteMany({ classroom: className });
        await mongoose.model('Chapter').deleteMany({ classroom: className });
        await mongoose.model('Homework').deleteMany({ classroom: className });
        return { ok: true, message: `Classe ${className} supprimée.` };
    },

    updateTeacherSections: async (teacherId, sections) => {
        const Teacher = mongoose.models.Teacher || mongoose.model('Teacher');
        const Chapter = mongoose.models.Chapter || mongoose.model('Chapter');
        
        // 🛡️ Protection des orphelins avant mise à jour
        const teacher = await Teacher.findById(teacherId);
        const newNames = (sections || []).map(s => s.name);
        const oldNames = (teacher.subjectSections || []).map(s => s.name);
        const deleted = oldNames.filter(n => !newNames.includes(n));

        if (deleted.length > 0) {
            await Chapter.updateMany({ teacherId, subject: { $in: deleted } }, { subject: "AUTRE" });
        }

        return await Teacher.findByIdAndUpdate(teacherId, { subjectSections: sections }, { new: true }).lean();
    },

    getFullDump: async () => {
        const models = ['Player', 'Chapter', 'Homework', 'GameLevel', 'Teacher', 'Submission', 'ScanSession'];
        const dump = {};
        for (const m of models) {
            try { dump[m.toLowerCase() + 's'] = await mongoose.model(m).find({}).lean(); } 
            catch (e) { dump[m.toLowerCase() + 's'] = []; }
        }
        return dump;
    }
};

module.exports = AdminService;