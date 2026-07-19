const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const { Teacher, Classroom, Student } = require('../server/prof/models/prof.models');
require('../server/models/Enrollment');

const Enrollment = mongoose.models.Enrollment;

const STUDENTS = [
  { firstName: 'Maxime', lastName: 'Durand', seatX: 0, seatY: 0 },
  { firstName: 'Lina', lastName: 'Martin', seatX: 1, seatY: 0 },
  { firstName: 'Nora', lastName: 'Bernard', seatX: 2, seatY: 0 }
];

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI manquant dans .env');
  }

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });

  const teacher = await Teacher.findOne({
    $and: [
      { lastName: /vuillet/i },
      { $or: [{ firstName: /^jp$/i }, { firstName: /jean/i }, { firstName: /j/i }] }
    ]
  });

  if (!teacher) {
    throw new Error('Professeur JP/Jean Vuillet introuvable.');
  }

  const classroom = await Classroom.findOneAndUpdate(
    { name: '3E B' },
    {
      $setOnInsert: {
        name: '3E B',
        level: '3',
        type: 'CLASS',
        layout: { separators: [], cols: 6, rows: 5 }
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  await Teacher.findByIdAndUpdate(teacher._id, { $addToSet: { assignedClasses: classroom._id } });

  const createdOrUpdated = [];
  for (const data of STUDENTS) {
    const fullName = `${data.firstName} ${data.lastName}`;
    const student = await Student.findOneAndUpdate(
      { firstName: data.firstName, lastName: data.lastName, currentClass: '3E B' },
      {
        $set: {
          ...data,
          fullName,
          currentClass: '3E B',
          currentLevel: '3',
          classId: classroom._id,
          hasStudentPassword: false,
          isTestAccount: false
        },
        $setOnInsert: {
          behaviorRecords: [],
          teacherNotes: [],
          punishmentStatus: 'NONE'
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (Enrollment) {
      await Enrollment.updateOne(
        { studentId: student._id, classId: classroom._id },
        { $setOnInsert: { studentId: student._id, classId: classroom._id } },
        { upsert: true }
      );
    }

    createdOrUpdated.push(`${student.firstName} ${student.lastName}`);
  }

  console.log(JSON.stringify({
    ok: true,
    teacher: `${teacher.firstName} ${teacher.lastName}`,
    class: classroom.name,
    classId: String(classroom._id),
    students: createdOrUpdated
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
