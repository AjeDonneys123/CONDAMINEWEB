const mongoose = require('mongoose');

const AuthExpert = {
    // 1. Récupérer la liste des classes pour le menu déroulant du Login
    getLoginConfig: async () => {
        try {
            // On vérifie que le modèle existe bien (protection contre le boot partiel)
            if (!mongoose.models.Classroom) return { classrooms: [] };
            
            const classrooms = await mongoose.model('Classroom').find({}).sort({name: 1}).lean();
            return { classrooms: classrooms || [] };
        } catch (e) {
            console.error("AuthExpert Config Error:", e);
            return { classrooms: [] };
        }
    },

    // 2. Récupérer les élèves d'une classe pour la recherche
    getStudentsForSelection: async (classId) => {
        try {
            if (!classId) return [];
            // On cherche dans les inscriptions (Enrollment)
            const enrollments = await mongoose.model('Enrollment').find({ classId }).populate('studentId').lean();
            
            return enrollments
                .filter(e => e.studentId) // On filtre les liens morts
                .map(e => ({
                    id: e.studentId._id,
                    name: `${e.studentId.firstName} ${e.studentId.lastName}`
                }))
                .sort((a, b) => a.name.localeCompare(b.name));
        } catch (e) {
            console.error("AuthExpert Students Error:", e);
            return [];
        }
    },

    // 3. Vérification du Login (Prof ou Élève)
    verify: async ({ role, studentId, firstName, lastName, password }) => {
        try {
            const fName = (firstName || '').trim();
            const lName = (lastName || '').trim();
            const pass = (password || '').trim();

            if (role === 'PROF') {
                // A. Jean Vuillet (SuperDev Backdoor)
                const isJean = (fName.toLowerCase() === 'jean' && lName.toLowerCase() === 'vuillet');
                if (isJean && (pass === 'Clémenceau1919' || pass === 'Clemenceau1919')) {
                    return { ok: true, user: { firstName: "Jean", lastName: "Vuillet", role: 'prof', isAdmin: true, isDeveloper: true } };
                }

                // B. Recherche dans la table Admin
                const Admin = mongoose.model('Admin');
                const adminInDb = await Admin.findOne({ 
                    firstName: new RegExp(`^${fName}$`, 'i'), 
                    lastName: new RegExp(`^${lName}$`, 'i') 
                });

                if (adminInDb && adminInDb.password === pass) {
                    return { 
                        ok: true, 
                        user: { 
                            firstName: adminInDb.firstName,
                            lastName: adminInDb.lastName,
                            role: 'prof', 
                            isAdmin: true, 
                            isDeveloper: adminInDb.role === 'developer' 
                        } 
                    };
                }

                // C. Recherche dans la table Teacher
                const Teacher = mongoose.model('Teacher');
                const teacherInDb = await Teacher.findOne({ 
                    firstName: new RegExp(`^${fName}$`, 'i'), 
                    lastName: new RegExp(`^${lName}$`, 'i') 
                });

                if (teacherInDb && teacherInDb.password === pass) {
                    return { ok: true, user: { ...teacherInDb.toObject(), role: 'prof', isAdmin: false, isDeveloper: false } };
                }

                return { ok: false, message: "Identification incorrecte" };
            } else {
                // LOGIN ÉLÈVE (Juste l'ID sélectionné)
                if (!studentId) return { ok: false, message: "Choisir un nom" };
                const student = await mongoose.model('Student').findById(studentId).lean();
                if (!student) return { ok: false, message: "Étudiant non trouvé" };
                return { ok: true, user: { ...student, id: student._id, role: 'student', isAdmin: false, isDeveloper: false } };
            }
        } catch (e) {
            console.error("Verification error:", e);
            return { ok: false, message: "Erreur technique serveur" };
        }
    }
};

module.exports = AuthExpert;