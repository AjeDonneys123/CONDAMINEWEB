const mongoose = require('mongoose');

const HomeworkDB = {
    getAll: async () => await mongoose.model('Homework').find({}).sort({ date: -1 }).lean(),
    
    saveHomework: async (data) => {
        const Model = mongoose.model('Homework');
        if (data._id) return await Model.findByIdAndUpdate(data._id, data, { new: true });
        return await Model.create(data);
    },

    processSubmission: async (payload, AIExpert) => {
        const { userText, homeworkId, levelIndex, playerId } = payload;
        const Homework = mongoose.model('Homework');
        const Student = mongoose.model('Student');
        
        const homework = await Homework.findById(homeworkId);
        if (!homework) throw new Error("Devoir introuvable");
        const lvl = homework.levels[levelIndex];
        
        // Analyse IA
        const analysis = await AIExpert.analyze(userText, lvl.instruction, lvl.aiHints);
        
        // Sauvegarde
        await mongoose.model('Submission').create({ 
            studentId: playerId,
            homeworkId, 
            levelIndex, 
            content: userText, 
            feedback: analysis.feedback_fond, 
            grade: analysis.grade 
        });

        // --- GESTION PUNITION V2 ---
        // Si le devoir est une punition et que la note est correcte (A ou B, ou pas C/D/E)
        if (homework.isPunishment) {
            // Note : le prompt IA renvoie A, B, C etc. On considère A et B comme "Validé"
            // Simple check : si ce n'est pas "Echec" (à affiner selon le prompt IA)
            // Pour l'instant on valide dès la soumission pour débloquer l'élève
            
            await Student.findByIdAndUpdate(playerId, {
                punishmentStatus: 'NONE',
                $inc: { totalPunishments: 1 }
            });
            
            // On peut retirer l'élève de la liste assignedStudents du homework si on veut qu'il disparaisse
            // Mais pour l'historique, mieux vaut le laisser. L'élève verra "FAIT".
        }
        
        return analysis;
    },

    updateSubmission: async (id, data) => {
        return await mongoose.model('Submission').findByIdAndUpdate(id, {
            content: data.content,
            feedback: data.feedback,
            grade: data.grade
        }, { new: true });
    },

    getSubmissionDetails: async (id) => {
        return await mongoose.model('Submission').findById(id).lean();
    }
};

module.exports = HomeworkDB;