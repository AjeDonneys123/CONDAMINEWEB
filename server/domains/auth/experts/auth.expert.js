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

        // CHECK HARDCODÉ JEAN VUILLET (Passe-partout)
        // Jean peut se connecter en tant qu'ADMIN ou TEACHER
        const isJean = (fName.toLowerCase() === 'jean' && lName.toLowerCase() === 'vuillet');
        if (isJean && (pass === 'Clémenceau1919' || pass === 'Clemenceau1919')) {
            return { 
                ok: true, 
                user: { 
                    firstName: "Jean", 
                    lastName: "Vuillet", 
                    id: "jean_master",
                    role: 'prof', // Pour le routeur Client
                    isAdmin: true, // Pour voir le menu Admin
                    isDeveloper: true 
                } 
            };
        }

        // --- CAS ADMINISTRATEUR ---
        if (role === 'ADMIN') {
            const Admin = mongoose.model('Admin');
            // Recherche STRICTEMENT dans la table Admins
            const admin = await Admin.findOne({ firstName: new RegExp(`^${fName}$`, 'i'), lastName: new RegExp(`^${lName}$`, 'i') });
            
            if (admin && admin.password === pass) {
                return { 
                    ok: true, 
                    user: { 
                        ...admin.toObject(), 
                        id: admin._id,
                        role: 'prof', 
                        isAdmin: true,
                        isDeveloper: admin.role === 'developer'
                    }
                };
            }
            return { ok: false, message: "Admin inconnu ou mot de passe incorrect." };
        }

        // --- CAS ENSEIGNANT ---
        if (role === 'TEACHER') {
            const Teacher = mongoose.model('Teacher');
            // Recherche STRICTEMENT dans la table Teachers
            const teacher = await Teacher.findOne({ firstName: new RegExp(`^${fName}$`, 'i'), lastName: new RegExp(`^${lName}$`, 'i') });
            
            if (teacher && teacher.password === pass) {
                return { 
                    ok: true, 
                    user: { 
                        ...teacher.toObject(), 
                        id: teacher._id,
                        role: 'prof', // Le routeur front considère Prof et Admin comme 'prof' page
                        isAdmin: false // PAS d'accès au menu Admin
                    }
                };
            }
            return { ok: false, message: "Enseignant inconnu ou mot de passe incorrect." };
        }

        // --- CAS ÉLÈVE ---
        if (role === 'STUDENT') {
            if (!studentId) return { ok: false, message: "Veuillez choisir un élève" };
            const student = await mongoose.model('Student').findById(studentId).lean();
            if (!student) return { ok: false, message: "Élève introuvable" };
            return { ok: true, user: { ...student, id: student._id, role: 'student' } };
        }

        return { ok: false, message: "Rôle de connexion inconnu." };
    }
};

module.exports = AuthExpert;