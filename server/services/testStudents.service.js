const mongoose = require('mongoose');

/**
 * Assure la présence d'un élève test unique par classe.
 * Règle stricte : ces élèves ont seatX = -1 et seatY = -1 et ne doivent
 * JAMAIS apparaître sur le plan de classe (filtrés par isTestAccount: true).
 */
async function ensureTestStudents() {
    try {
        const Classroom = mongoose.model('Classroom');
        const Student = mongoose.model('Student');

        // 1. Récupérer toutes les classes réelles (type CLASS)
        const classrooms = await Classroom.find({ type: 'CLASS' }).lean();

        // 2. Récupérer les classes distinctes existantes dans la base d'élèves
        const distinctClasses = await Student.distinct('currentClass');

        const classMap = new Map();

        // Enregistrer les classes officielles
        classrooms.forEach((c) => {
            const name = String(c.name || '').trim();
            if (name) {
                const cleanCode = name.toLowerCase().replace(/[^a-z0-9]/g, '');
                classMap.set(name.toUpperCase(), {
                    name,
                    cleanCode,
                    classId: c._id,
                    level: c.level || ''
                });
            }
        });

        // Ajouter les classes historiques éventuelles si non présentes (sauf SANS CLASSE)
        distinctClasses.forEach((cName) => {
            const clean = String(cName || '').trim();
            if (clean && clean.toUpperCase() !== 'SANS CLASSE' && !classMap.has(clean.toUpperCase())) {
                const cleanCode = clean.toLowerCase().replace(/[^a-z0-9]/g, '');
                let level = '';
                if (/^2/i.test(clean)) level = '2';
                else if (/^3/i.test(clean)) level = '3';
                else if (/^5/i.test(clean)) level = '5';
                else if (/^6/i.test(clean)) level = '6';
                else if (/^1/i.test(clean)) level = '1';

                classMap.set(clean.toUpperCase(), {
                    name: clean,
                    cleanCode,
                    classId: null,
                    level
                });
            }
        });

        const created = [];
        const updated = [];

        for (const [key, info] of classMap.entries()) {
            const expectedFirstName = `Élève Test ${info.name}`;
            const expectedEmail = `test.${info.cleanCode}@condamine.edu.ec`;

            const query = {
                currentClass: new RegExp(`^\\s*${info.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'),
                $or: [
                    { isTestAccount: true },
                    { lastName: 'TEST' },
                    { email: expectedEmail }
                ]
            };

            let student = await Student.findOne(query);

            if (!student) {
                // Créer l'élève test
                student = new Student({
                    firstName: expectedFirstName,
                    lastName: 'TEST',
                    fullName: `${expectedFirstName} TEST`,
                    currentClass: info.name,
                    classId: info.classId,
                    currentLevel: info.level,
                    seatX: -1,
                    seatY: -1,
                    isTestAccount: true,
                    email: expectedEmail,
                    birthDate: '01/01/2010',
                    dateOfBirth: '01/01/2010',
                    dob: '01/01/2010',
                    password: 'test',
                    studentPassword: 'test',
                    hasStudentPassword: true,
                    punishmentStatus: 'NONE',
                    gender: 'M'
                });
                await student.save();
                created.push(`${student.firstName} ${student.lastName} [${info.name}]`);
            } else {
                // S'assurer qu'il a bien isTestAccount = true et qu'il n'est pas assis
                let modified = false;
                if (student.isTestAccount !== true) {
                    student.isTestAccount = true;
                    modified = true;
                }
                if (student.seatX !== -1 || student.seatY !== -1) {
                    student.seatX = -1;
                    student.seatY = -1;
                    modified = true;
                }
                if (info.classId && String(student.classId || '') !== String(info.classId)) {
                    student.classId = info.classId;
                    modified = true;
                }
                if (info.level && student.currentLevel !== info.level) {
                    student.currentLevel = info.level;
                    modified = true;
                }
                if (student.firstName !== expectedFirstName) {
                    student.firstName = expectedFirstName;
                    modified = true;
                }
                if (student.lastName !== 'TEST') {
                    student.lastName = 'TEST';
                    modified = true;
                }
                if (student.email !== expectedEmail) {
                    student.email = expectedEmail;
                    modified = true;
                }
                if (student.studentPassword !== 'test') {
                    student.studentPassword = 'test';
                    student.hasStudentPassword = true;
                    modified = true;
                }
                if (Array.isArray(student.behaviorRecords)) {
                    student.behaviorRecords = student.behaviorRecords.filter(r => r && r.teacherId);
                }
                if (modified) {
                    await student.save();
                    updated.push(`${student.firstName} ${student.lastName} [${info.name}]`);
                }
            }
        }

        console.info(`[TestStudents] Synced test students: ${created.length} created, ${updated.length} updated.`);
        return { ok: true, created, updated, totalClasses: classMap.size };
    } catch (e) {
        console.error('[TestStudents] Error ensuring test students:', e);
        return { ok: false, error: e.message };
    }
}

module.exports = {
    ensureTestStudents
};
