#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'studio-games');

function parseArgs(argv) {
  const args = { cmd: '', id: '', file: '' };
  const rest = argv.slice(2);
  args.cmd = rest[0] || '';
  for (let i = 1; i < rest.length; i += 1) {
    const a = rest[i];
    if (a === '--id') args.id = rest[i + 1] || '';
    if (a === '--file') args.file = rest[i + 1] || '';
  }
  return args;
}

function usage() {
  console.log([
    'Usage:',
    '  node scripts/studio-game-sync.js pull --id <studioProjectId> [--file studio-games/<id>.js]',
    '  node scripts/studio-game-sync.js push --id <studioProjectId> [--file studio-games/<id>.js]',
    '',
    'Notes:',
    '  - pull: exporte generatedCode vers un fichier local éditable',
    '  - push: réimporte le fichier local vers generatedCode du projet'
  ].join('\n'));
}

async function main() {
  const { cmd, id, file } = parseArgs(process.argv);
  if (!cmd || !id || !mongoose.Types.ObjectId.isValid(String(id))) {
    usage();
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI manquant dans .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const { StudioProject } = require('../server/prof/models/prof.models');
  const project = await StudioProject.findById(id);
  if (!project) {
    console.error(`Projet introuvable: ${id}`);
    process.exit(1);
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = file
    ? path.resolve(ROOT, file)
    : path.join(OUT_DIR, `${id}.js`);
  const metaFile = path.join(OUT_DIR, `${id}.meta.json`);

  if (cmd === 'pull') {
    fs.writeFileSync(outFile, String(project.generatedCode || ''), 'utf8');
    fs.writeFileSync(
      metaFile,
      JSON.stringify(
        {
          _id: String(project._id),
          title: project.title || '',
          updatedAt: project.updatedAt || null,
          extractedAt: new Date().toISOString()
        },
        null,
        2
      ),
      'utf8'
    );
    console.log(`OK pull -> ${path.relative(ROOT, outFile)}`);
    await mongoose.disconnect();
    return;
  }

  if (cmd === 'push') {
    if (!fs.existsSync(outFile)) {
      console.error(`Fichier introuvable: ${outFile}`);
      process.exit(1);
    }
    const code = fs.readFileSync(outFile, 'utf8');
    project.generatedCode = code;
    await project.save();
    console.log(`OK push <- ${path.relative(ROOT, outFile)} (len=${code.length})`);
    await mongoose.disconnect();
    return;
  }

  usage();
  await mongoose.disconnect();
  process.exit(1);
}

main().catch(async (e) => {
  console.error('Erreur:', e.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});

