const mongoose = require('mongoose');
const DriveService = require('./drive.service');

const HomeworkService = {
    createHomework: async (data, teacherId) => {
        const prof = await mongoose.model('Teacher').findById(teacherId);
        const chap = await mongoose.model('Chapter').findById(data.chapterId);
        if (!prof || !chap) throw new Error("Données manquantes");

        const paths = await DriveService.getMirrorPathId(
            `${prof.firstName} ${prof.lastName}`, 
            data.classroom, 
            chap.subject, 
            chap.title
        );

        const driveId = await DriveService.getOrCreateFolder(data.title, paths.chapterId);
        
        if (driveId) {
            await DriveService.getOrCreateFolder("SUJET", driveId);
            await DriveService.getOrCreateFolder("COPIES", driveId);
            await DriveService.getOrCreateFolder("CORRECTIONS", driveId);
        }

        const Homework = mongoose.model('Homework');
        return await Homework.create({ ...data, driveFolderId: driveId });
    }
};

module.exports = HomeworkService;