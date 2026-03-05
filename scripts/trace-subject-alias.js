#!/usr/bin/env node
const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
  const rawAlias = String(process.argv[2] || 'SS').trim();
  if (!rawAlias) throw new Error('Alias manquant');
  const alias = rawAlias.toUpperCase();
  const cls = String(process.argv[3] || '').trim().toUpperCase();

  await mongoose.connect(process.env.MONGODB_URI);

  const Subject = mongoose.model('Subject', new mongoose.Schema({}, { strict: false }), 'subjects');
  const Chapter = mongoose.model('Chapter', new mongoose.Schema({}, { strict: false }), 'chapters');
  const Teacher = mongoose.model('Teacher', new mongoose.Schema({}, { strict: false }), 'teachers');
  const Homework = mongoose.model('Homework', new mongoose.Schema({}, { strict: false }), 'homeworks');
  const GameLevel = mongoose.model('GameLevel', new mongoose.Schema({}, { strict: false }), 'gamelevels');
  const LearningModule = mongoose.model('LearningModule', new mongoose.Schema({}, { strict: false }), 'learningmodules');
  const Expose = mongoose.model('Expose', new mongoose.Schema({}, { strict: false }), 'exposes');

  const byExactUpper = { $expr: { $eq: [{ $toUpper: { $ifNull: ['$subject', ''] } }, alias] } };
  const bySectionExactUpper = { $expr: { $eq: [{ $toUpper: { $ifNull: ['$section', ''] } }, alias] } };
  const byNameExactUpper = { $expr: { $eq: [{ $toUpper: { $ifNull: ['$name', ''] } }, alias] } };

  const [subjects, chapters, teachers, homeworks, games, learnings, exposes] = await Promise.all([
    Subject.find(byNameExactUpper, '_id name').lean(),
    Chapter.find(bySectionExactUpper, '_id title section classroom sharedLevel').lean(),
    Teacher.find(
      { $or: [{ subjectSections: { $elemMatch: { name: new RegExp(`^${alias}$`, 'i') } } }, { taughtSubjects: { $exists: true } }] },
      '_id firstName lastName taughtSubjects subjectSections assignedClasses'
    ).lean(),
    Homework.find(byExactUpper, '_id title subject targetClassrooms chapterId teacherId').lean(),
    GameLevel.find(byExactUpper, '_id title subject targetClassrooms chapterId teacherId').lean(),
    LearningModule.find(byExactUpper, '_id title subject targetClassrooms chapterId teacherId').lean(),
    Expose.find(byExactUpper, '_id title subject targetClassrooms chapterId teacherId').lean()
  ]);

  const classFilter = (doc) => {
    if (!cls) return true;
    const targets = (doc?.targetClassrooms || []).map((x) => String(x || '').toUpperCase());
    const classroom = String(doc?.classroom || '').toUpperCase();
    const sharedLevel = String(doc?.sharedLevel || '').toUpperCase();
    return targets.includes(cls) || classroom === cls || sharedLevel === cls;
  };

  const report = {
    alias,
    classFilter: cls || null,
    subjects: subjects.filter(classFilter),
    chapters: chapters.filter(classFilter),
    teachers: teachers
      .map((t) => {
        const sections = (t.subjectSections || [])
          .map((s) => String(s?.name || '').toUpperCase())
          .filter((n) => n === alias);
        return {
          _id: String(t._id),
          name: `${t.firstName || ''} ${t.lastName || ''}`.trim(),
          matchingSections: sections,
          taughtSubjectsCount: (t.taughtSubjects || []).length
        };
      })
      .filter((t) => t.matchingSections.length > 0),
    homeworks: homeworks.filter(classFilter),
    games: games.filter(classFilter),
    learnings: learnings.filter(classFilter),
    exposes: exposes.filter(classFilter)
  };

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error('TRACE ERROR:', e.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});

