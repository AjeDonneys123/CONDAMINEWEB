const mongoose = require('mongoose');

/**
 * 🔐 EXPERT AUTH - VERSION 30
 * Logique de rôles basée sur 'isDeveloper'.
 */
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

        // 1. JEAN VUILLET : DÉVELOPPEUR SUPRÊME
        const isJean = (fName.toLowerCase() === 'jean' && lName.toLowerCase() === 'vuillet');
        if (isJean && (pass === 'Clémenceau1919' || pass === 'Clemenceau1919' || pass === 'A')) {
            const Admin = mongoose.model('Admin');
            let realJean = await Admin.findOne({ firstName: 'Jean', lastName: 'Vuillet' });
            if (!realJean) {
                realJean = await Admin.create({ firstName: 'Jean', lastName: 'Vuillet', password: pass, isDeveloper: true });
            }
            return { 
                ok: true, 
                user: { 
                    ...realJean.toObject(),
                    id: realJean._id,
                    role: 'prof', 
                    isDeveloper: true // Droits totaux
                } 
            };
        }

        // 2. STAFF ADMIN
        if (role === 'ADMIN') {
            const admin = await mongoose.model('Admin').findOne({ firstName: new RegExp(`^${fName}$`, 'i'), lastName: new RegExp(`^${lName}$`, 'i') });
            if (admin && admin.password === pass) {
                return { 
                    ok: true, 
                    user: { 
                        ...admin.toObject(), 
                        id: admin._id, 
                        role: 'admin', // Rôle technique
                        isDeveloper: admin.isDeveloper === true
                    }
                };
            }
        }

        // 3. ENSEIGNANTS
        if (role === 'TEACHER') {
            const teacher = await mongoose.model('Teacher').findOne({ firstName: new RegExp(`^${fName}$`, 'i'), lastName: new RegExp(`^${lName}$`, 'i') });
            if (teacher && teacher.password === pass) {
                return { 
                    ok: true, 
                    user: { 
                        ...teacher.toObject(), 
                        id: teacher._id, 
                        role: 'prof', 
                        isDeveloper: teacher.isDeveloper === true 
                    }
                };
            }
        }

        // 4. ÉLÈVES
        if (role === 'STUDENT') {
            if (!studentId) return { ok: false, message: "Choisir un élève" };
            const student = await mongoose.model('Student').findById(studentId).lean();
            if (!student) return { ok: false, message: "Élève introuvable" };
            return { ok: true, user: { ...student, id: student._id, role: 'student' } };
        }

        return { ok: false, message: "Identifiants incorrects" };
    }
};

module.exports = AuthExpert;