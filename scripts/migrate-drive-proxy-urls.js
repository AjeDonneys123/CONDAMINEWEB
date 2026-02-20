#!/usr/bin/env node
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const LEGACY_PREFIX = '/api/prof/structure/proxy/';
const NEW_PREFIX = '/api/structure/proxy/';

function deepReplace(value) {
    if (typeof value === 'string') {
        if (value.includes(LEGACY_PREFIX)) {
            return { value: value.replaceAll(LEGACY_PREFIX, NEW_PREFIX), changed: true };
        }
        return { value, changed: false };
    }
    if (Array.isArray(value)) {
        let changed = false;
        const next = value.map((item) => {
            const out = deepReplace(item);
            if (out.changed) changed = true;
            return out.value;
        });
        return { value: next, changed };
    }
    if (value && typeof value === 'object') {
        let changed = false;
        const next = {};
        for (const [k, v] of Object.entries(value)) {
            const out = deepReplace(v);
            if (out.changed) changed = true;
            next[k] = out.value;
        }
        return { value: next, changed };
    }
    return { value, changed: false };
}

async function migrateModel(name) {
    if (!mongoose.models[name]) {
        return { model: name, scanned: 0, updated: 0, skipped: true };
    }
    const Model = mongoose.model(name);
    const docs = await Model.find({}).lean();
    let updated = 0;

    for (const doc of docs) {
        const src = JSON.stringify(doc);
        if (!src.includes(LEGACY_PREFIX)) continue;

        const transformed = deepReplace(doc);
        if (!transformed.changed) continue;

        const payload = transformed.value;
        delete payload._id;
        delete payload.__v;
        await Model.findByIdAndUpdate(doc._id, payload, { new: false });
        updated += 1;
    }
    return { model: name, scanned: docs.length, updated, skipped: false };
}

async function main() {
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is required');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    require('../server/prof/models/prof.models');

    const targets = ['ScanSession', 'StudioProject', 'GameLevel', 'Homework'];
    const report = [];
    for (const name of targets) {
        // eslint-disable-next-line no-await-in-loop
        report.push(await migrateModel(name));
    }

    console.log('Drive URL migration report');
    report.forEach((row) => {
        if (row.skipped) console.log(`- ${row.model}: skipped (model not loaded)`);
        else console.log(`- ${row.model}: updated ${row.updated}/${row.scanned}`);
    });

    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error('Migration failed:', err.message);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
});
