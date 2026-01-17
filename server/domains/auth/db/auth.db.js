




const mongoose = require('mongoose');

/**
 * 💾 COUCHE DB AUTH : Accès brut aux données de login
 */
const AuthDB = {
    getAllClassrooms: async () => {
        return await mongoose.model('Classroom').find({}).sort({ name: 1 }).lean();
    },
    getEnrollmentsByClass: async (classId) => {
        return await mongoose.model('Enrollment').find({ classId }).populate('studentId').lean();
    },
    findStudentById: async (id) => {
        return await mongoose.model('Student').findById(id).lean();
    }
};

module.exports = AuthDB;




