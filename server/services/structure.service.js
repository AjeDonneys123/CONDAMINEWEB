const mongoose = require('mongoose');
const DriveService = require('./drive.service');

const StructureService = {
    createChapter: async (data) => {
        const { teacherId, classroom, subject, title, _id } = data;
        const prof = await mongoose.model('Teacher').findById(teacherId);
        if (!prof) throw new Error("Teacher not found");
        const teacherName = `${prof.firstName} ${prof.lastName}`;
        const driveContext = await DriveService.getMirrorPathId(teacherName, classroom, subject, title);
        if (!driveContext.chapterId) throw new Error("Drive creation failed");
        const Chapter = mongoose.model('Chapter');
        const payload = { title, subject, classroom, driveFolderId: driveContext.chapterId, teacherId };
        return _id ? await Chapter.findByIdAndUpdate(_id, payload, { new: true }) : await Chapter.create(payload);
    },
    deleteChapter: async (id) => {
        const Chapter = mongoose.model('Chapter');
        const chap = await Chapter.findById(id);
        if (chap?.driveFolderId) await DriveService.deleteEntity(chap.driveFolderId);
        return await Chapter.findByIdAndDelete(id);
    }
};
module.exports = StructureService;