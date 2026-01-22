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
        const homework = await mongoose.model('Homework').findById(homeworkId);
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
        
        return analysis;
    },

    // --- NOUVEAU V210 : MODIFICATION PAR LE PROF ---
    updateSubmission: async (id, data) => {
        return await mongoose.model('Submission').findByIdAndUpdate(id, {
            content: data.content,   // Le prof peut corriger le texte de l'élève
            feedback: data.feedback, // Le prof peut réécrire le feedback
            grade: data.grade        // Le prof peut changer la note
        }, { new: true });
    },

    getSubmissionDetails: async (id) => {
        return await mongoose.model('Submission').findById(id).lean();
    }
};

module.exports = HomeworkDB;