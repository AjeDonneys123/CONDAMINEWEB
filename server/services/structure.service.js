const mongoose = require('mongoose');
const DriveService = require('./drive.service');

const StructureService = {
    createChapter: async (data) => {
        const prof = await mongoose.model('Teacher').findById(data.teacherId);
        const paths = await DriveService.getMirrorPathId(
            `${prof.firstName} ${prof.lastName}`, 
            data.classroom, 
            data.subject, 
            data.title
        );
        const Chapter = mongoose.model('Chapter');
        return await Chapter.create({ ...data, driveFolderId: paths.chapterId });
    }
};

module.exports = StructureService;