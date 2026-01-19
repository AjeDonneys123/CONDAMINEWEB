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

        // 1. BACKDOOR DÉVELOPPEUR (JEAN VUILLET)
        const isJean = (fName.toLowerCase() === 'jean' && lName.toLowerCase() === 'vuillet');
        if (isJean && (pass === 'Clémenceau1919' || pass === 'Clemenceau1919' || pass === 'A')) {
            await ensureUserExists('Admin', { firstName: 'Jean', lastName: 'Vuillet', password: pass, role: 'developer' });
            // On récupère le vrai ID pour que les logs fonctionnent
            const realJean = await mongoose.model('Admin').findOne({ firstName: 'Jean', lastName: 'Vuillet' });
            return { 
                ok: true, 
                user: { 
                    ...realJean.toObject(),
                    id: realJean._id,
                    role: 'prof', 
                    isAdmin: true, 
                    isDeveloper: true 
                } 
            };
        }

        // 2. BACKDOOR & AUTO-CRÉATION COMPTES TEST (Mot de passe "A")
        if (pass === 'A') {
            // > ADMIN TEST
            if (role === 'ADMIN' && fName.toLowerCase() === 'admin' && lName.toLowerCase() === 'test') {
                let admin = await mongoose.model('Admin').findOne({ firstName: 'Admin', lastName: 'Test' });
                if (!admin) {
                    // Création automatique si inexistant
                    admin = await mongoose.model('Admin').create({ 
                        firstName: 'Admin', lastName: 'Test', password: 'A', role: 'admin' 
                    });
                }
                return { 
                    ok: true, 
                    user: { ...admin.toObject(), id: admin._id, role: 'prof', isAdmin: true, isDeveloper: false } 
                };
            }
            
            // > PROF TEST
            if (role === 'TEACHER' && fName.toLowerCase() === 'prof' && lName.toLowerCase() === 'test') {
                let teacher = await mongoose.model('Teacher').findOne({ firstName: 'Prof', lastName: 'Test' });
                if (!teacher) {
                    // Création automatique si inexistant
                    teacher = await mongoose.model('Teacher').create({ 
                        firstName: 'Prof', lastName: 'Test', password: 'A', subjectSections: [] 
                    });
                }
                return { 
                    ok: true, 
                    user: { ...teacher.toObject(), id: teacher._id, role: 'prof', isAdmin: false, isDeveloper: false } 
                };
            }
        }

        // 3. AUTHENTIFICATION NORMALE (BDD)

        if (role === 'ADMIN') {
            const admin = await mongoose.model('Admin').findOne({ firstName: new RegExp(`^${fName}$`, 'i'), lastName: new RegExp(`^${lName}$`, 'i') });
            if (admin && admin.password === pass) {
                return { 
                    ok: true, 
                    user: { ...admin.toObject(), id: admin._id, role: 'prof', isAdmin: true, isDeveloper: admin.role === 'developer' }
                };
            }
            return { ok: false, message: "Admin inconnu." };
        }

        if (role === 'TEACHER') {
            const teacher = await mongoose.model('Teacher').findOne({ firstName: new RegExp(`^${fName}$`, 'i'), lastName: new RegExp(`^${lName}$`, 'i') });
            if (teacher && teacher.password === pass) {
                return { 
                    ok: true, 
                    user: { ...teacher.toObject(), id: teacher._id, role: 'prof', isAdmin: false }
                };
            }
            return { ok: false, message: "Professeur inconnu." };
        }

        if (role === 'STUDENT') {
            if (!studentId) return { ok: false, message: "Veuillez choisir un élève" };
            const student = await mongoose.model('Student').findById(studentId).lean();
            if (!student) return { ok: false, message: "Élève introuvable" };
            return { ok: true, user: { ...student, id: student._id, role: 'student' } };
        }

        return { ok: false, message: "Rôle inconnu." };
    }
};

async function ensureUserExists(modelName, data) {
    const Model = mongoose.model(modelName);
    const exists = await Model.findOne({ firstName: data.firstName, lastName: data.lastName });
    if (!exists) await Model.create(data);
}

module.exports = AuthExpert;