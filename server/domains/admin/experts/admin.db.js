const AdminDB = require('../db/admin.db');
const mongoose = require('mongoose');

// Expert métier qui orchestre les appels DB
const AdminExpert = {
    getAllStudents: async () => {
        return await AdminDB.findStudents({});
    },
    getFullDump: async () => {
        const data = await AdminDB.findEverything();
        data.submissions = await mongoose.model('Submission').find({}).lean();
        return data;
    },
    updateTeacherSections: async (id, sections) => {
        return await mongoose.model('Teacher').findByIdAndUpdate(id, { subjectSections: sections }, { new: true }).lean();
    }
};
module.exports = AdminExpert;