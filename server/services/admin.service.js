const mongoose = require('mongoose');

const AdminService = {
    getAllPlayers: async () => {
        return await mongoose.model('Player').find({}).sort({ classroom: 1, lastName: 1 }).lean();
    },
    deleteClassroom: async (className) => {
        await mongoose.model('Player').deleteMany({ classroom: className });
        await mongoose.model('Chapter').deleteMany({ classroom: className });
        await mongoose.model('Homework').deleteMany({ classroom: className });
    },
    updateTeacherSections: async (teacherId, sections) => {
        return await mongoose.model('Teacher').findByIdAndUpdate(teacherId, { subjectSections: sections }, { new: true }).lean();
    }
};

module.exports = AdminService;