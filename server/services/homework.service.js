const mongoose = require('mongoose');
const AIService = require('./ai.service');
const MistakeService = require('./mistake.service');

/**
 * 🧠 SERVICE : LOGIQUE MÉTIER DEVOIRS
 * Mission : Encapsuler l'intelligence de correction et de stockage.
 */
const HomeworkService = {
    processSubmission: async (data) => {
        const { userText, homeworkInstruction, classroom, playerId, homeworkId, levelIndex } = data;
        
        // 1. Récupération du style
        const style = await mongoose.model('TeacherStyle').findOne({ teacherId: "jean_vuillet" });
        
        // 2. Appel IA
        const analysis = await AIService.analyzeSubmission(
            userText, 
            homeworkInstruction, 
            classroom, 
            style?.pedagogicalMemory || ""
        );
        
        // 3. Archivage des fautes (Service Découplé)
        if (playerId && analysis.corrections) {
            await MistakeService.archiveMistakes(playerId, analysis.corrections);
        }
        
        // 4. Création de la soumission
        const submission = await mongoose.model('Submission').create({ 
            playerId, homeworkId, levelIndex, 
            originalTranscription: userText, 
            feedback: analysis.feedback_fond, 
            grade: analysis.grade 
        });

        return { analysis, submissionId: submission._id };
    }
};

module.exports = HomeworkService;