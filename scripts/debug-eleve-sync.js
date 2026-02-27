#!/usr/bin/env node
const mongoose = require('mongoose');
require('dotenv').config();

function normalizeTargetKey(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function addClassTarget(set, value) {
  const key = normalizeTargetKey(value);
  if (key) set.add(key);
}

async function main() {
  const q = (process.argv[2] || 'equiele').trim();
  await mongoose.connect(process.env.MONGODB_URI);

  const Student = mongoose.model('Student', new mongoose.Schema({}, { strict: false }), 'students');
  const Classroom = mongoose.model('Classroom', new mongoose.Schema({}, { strict: false }), 'classrooms');
  const Homework = mongoose.model('Homework', new mongoose.Schema({}, { strict: false }), 'homeworks');
  const GameLevel = mongoose.model('GameLevel', new mongoose.Schema({}, { strict: false }), 'gamelevels');
  const Enrollment = mongoose.model('Enrollment', new mongoose.Schema({}, { strict: false }), 'enrollments');

  const rx = new RegExp(q, 'i');
  const student = await Student.findOne({
    $or: [{ firstName: rx }, { lastName: rx }, { currentClass: rx }]
  }).lean();

  if (!student) {
    console.log('No student found for query:', q);
    await mongoose.disconnect();
    return;
  }

  console.log('\n=== STUDENT ===');
  console.log({
    id: String(student._id),
    firstName: student.firstName,
    lastName: student.lastName,
    currentClass: student.currentClass,
    classId: student.classId ? String(student.classId) : null,
    assignedGroups: (student.assignedGroups || []).map((g) => String(g && g._id ? g._id : g))
  });

  const targets = new Set();
  addClassTarget(targets, student.currentClass);

  if (student.classId && mongoose.Types.ObjectId.isValid(String(student.classId))) {
    const cls = await Classroom.findById(student.classId).lean();
    addClassTarget(targets, cls?.name);
  } else if (student.classId) {
    addClassTarget(targets, student.classId);
  }

  const groupRaw = (student.assignedGroups || [])
    .map((g) => String(g && g._id ? g._id : g))
    .filter(Boolean);
  const groupIds = groupRaw.filter((id) => mongoose.Types.ObjectId.isValid(id));
  const groupNames = groupRaw.filter((id) => !mongoose.Types.ObjectId.isValid(id));

  if (groupIds.length) {
    const groups = await Classroom.find({ _id: { $in: groupIds } }, 'name type level').lean();
    console.log('\n=== ASSIGNED GROUP OBJECTS ===');
    console.log(groups.map((g) => ({ id: String(g._id), name: g.name, type: g.type, level: g.level })));
    groups.forEach((g) => addClassTarget(targets, g.name));
  }
  groupNames.forEach((name) => addClassTarget(targets, name));

  const enrollments = await Enrollment.find({ studentId: student._id }, 'classId yearId').lean();
  if (enrollments.length) {
    const enrollClassIds = enrollments
      .map((e) => String(e.classId || ''))
      .filter((id) => mongoose.Types.ObjectId.isValid(id));
    const enrollClasses = await Classroom.find({ _id: { $in: enrollClassIds } }, 'name type level').lean();
    console.log('\n=== ENROLLMENTS ===');
    console.log(enrollments.map((e) => ({ classId: String(e.classId), yearId: String(e.yearId || '') })));
    console.log(enrollClasses.map((c) => ({ id: String(c._id), name: c.name, type: c.type, level: c.level })));
    enrollClasses.forEach((c) => addClassTarget(targets, c.name));
  }

  const targetKeys = [...targets];
  console.log('\n=== TARGET KEYS ===');
  console.log(targetKeys);

  const isAssignedToStudent = (arr = []) => arr.some((id) => String(id) === String(student._id));
  const matchTargets = (arr = []) => arr.some((t) => targets.has(normalizeTargetKey(t)));

  const homeworks = await Homework.find({ isEnabled: { $ne: false } })
    .sort({ date: -1 })
    .limit(200)
    .lean();
  const games = await GameLevel.find({ isEnabled: { $ne: false }, isTestGame: { $ne: true } })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const hwMatches = homeworks
    .map((h) => {
      const assigned = isAssignedToStudent(h.assignedStudents || []);
      const classMatch = !!h.isAllClass && matchTargets(h.targetClassrooms || []);
      return { h, assigned, classMatch, ok: assigned || classMatch };
    })
    .filter((x) => x.ok);

  const gameMatches = games
    .map((g) => {
      const assigned = isAssignedToStudent(g.assignedStudents || []);
      const classMatch = !!g.isAllClass && matchTargets(g.targetClassrooms || []);
      return { g, assigned, classMatch, ok: assigned || classMatch };
    })
    .filter((x) => x.ok);

  console.log('\n=== HOMEWORK MATCHES ===', hwMatches.length);
  console.log(
    hwMatches.slice(0, 30).map((x) => ({
      id: String(x.h._id),
      title: x.h.title,
      isAllClass: x.h.isAllClass,
      targets: x.h.targetClassrooms || [],
      assigned: x.assigned,
      classMatch: x.classMatch
    }))
  );

  console.log('\n=== GAME MATCHES ===', gameMatches.length);
  console.log(
    gameMatches.slice(0, 30).map((x) => ({
      id: String(x.g._id),
      title: x.g.title,
      isAllClass: x.g.isAllClass,
      targets: x.g.targetClassrooms || [],
      assigned: x.assigned,
      classMatch: x.classMatch
    }))
  );

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error('DEBUG ERROR:', e.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
