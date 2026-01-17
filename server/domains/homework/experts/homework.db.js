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
        const lvl = homework.levels[levelIndex];
        const analysis = await AIExpert.analyze(userText, lvl.instruction, lvl.aiHints);
        await mongoose.model('Submission').create({ 
            playerId, 
            homeworkId, 
            levelIndex, 
            feedback: analysis.feedback_fond, 
            grade: analysis.grade 
        });
        return analysis;
    }
};

module.exports = HomeworkDB;