const mongoose = require('mongoose');
const AIService = require('./ai.service');
const MistakeService = require('./mistake.service');
const DriveService = require('./drive.service');

/**
 * 🧠 SERVICE : DEVOIRS
 * Mission : Encapsuler l'IA et la création des sous-dossiers Drive.
 */
const HomeworkService = {
    processSubmission: async (data) => {
        const { userText, homeworkInstruction, classroom, playerId, homeworkId, levelIndex } = data;
        const style = await mongoose.model('TeacherStyle').findOne({ teacherId: "jean_vuillet" });
        const analysis = await AIService.analyzeSubmission(userText, homeworkInstruction, classroom, style?.pedagogicalMemory || "");
        
        if (playerId && analysis.corrections) {
            await MistakeService.archiveMistakes(playerId, analysis.corrections);
        }
        
        await mongoose.model('Submission').create({ 
            playerId, homeworkId, levelIndex, originalTranscription: userText, 
            feedback: analysis.feedback_fond, grade: analysis.grade 
        });
        return analysis;
    },

    createHomework: async (homeworkData, teacherId) => {
        const { chapterId, title, classroom } = homeworkData;
        const prof = await mongoose.model('Teacher').findById(teacherId);
        const chap = await mongoose.model('Chapter').findById(chapterId);
        if (!prof || !chap) throw new Error("Contexte manquant (Prof/Dossier)");

        let driveId = homeworkData.driveFolderId;
        if (!driveId) {
            const teacherName = `${prof.firstName} ${prof.lastName}`;
            const pathInfo = await DriveService.getMirrorPathId(teacherName, classroom, chap.subject, chap.title);
            driveId = await DriveService.getOrCreateFolder(title, pathInfo.chapterId);
            if (driveId) {
                // US#4 : Création atomique de la structure de travail
                await DriveService.getOrCreateFolder("SUJET", driveId);
                await DriveService.getOrCreateFolder("COPIES", driveId);
                await DriveService.getOrCreateFolder("CORRECTIONS", driveId);
            }
        }
        const Homework = mongoose.model('Homework');
        const payload = { ...homeworkData, driveFolderId: driveId };
        return homeworkData._id ? await Homework.findByIdAndUpdate(homeworkData._id, payload, { new: true }) : await Homework.create(payload);
    }
};

module.exports = HomeworkService;