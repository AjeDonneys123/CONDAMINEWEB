const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const { Teacher, Classroom } = require('../server/prof/models/prof.models');

const normalize = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toUpperCase();

const is6e = (cls) => {
  const name = normalize(cls?.name);
  const level = normalize(cls?.level);
  return level === '6' || /^6/.test(name);
};

const is3e = (cls) => {
  const name = normalize(cls?.name);
  const level = normalize(cls?.level);
  return level === '3' || /^3/.test(name);
};

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI manquant dans .env');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });

  const teacher = await Teacher.findOne({
    $and: [
      { lastName: /vuillet/i },
      { $or: [{ firstName: /^jp$/i }, { firstName: /jean/i }, { firstName: /j/i }] }
    ]
  }).populate('assignedClasses', 'name level type');

  if (!teacher) throw new Error('Professeur JP/Jean Vuillet introuvable.');

  const all3eClasses = await Classroom.find({
    type: { $ne: 'GROUP' },
    $or: [
      { level: /^3$/i },
      { name: /^3/i }
    ]
  }).sort({ name: 1 }).lean();

  if (all3eClasses.length === 0) {
    throw new Error('Aucune classe de 3e trouvée.');
  }

  const previous = Array.isArray(teacher.assignedClasses) ? teacher.assignedClasses : [];
  const kept = previous.filter((cls) => !is6e(cls));
  const nextIds = [...new Set([
    ...kept.map((cls) => String(cls._id)),
    ...all3eClasses.map((cls) => String(cls._id))
  ])];

  await Teacher.findByIdAndUpdate(teacher._id, { $set: { assignedClasses: nextIds } });

  const nextClasses = await Classroom.find({ _id: { $in: nextIds } }, 'name level type').sort({ name: 1 }).lean();

  console.log(JSON.stringify({
    ok: true,
    teacher: `${teacher.firstName} ${teacher.lastName}`,
    removed6e: previous.filter(is6e).map((cls) => cls.name),
    added3e: all3eClasses.map((cls) => cls.name),
    nowAssigned: nextClasses.map((cls) => cls.name)
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
