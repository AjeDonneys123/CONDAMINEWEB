require('dotenv').config();
const fs = require('fs');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');

require('../server/prof/models/prof.models');
const ProfDrive = require('../server/prof/core/drive.prof');

const Expose = mongoose.model('Expose');

function parseDataUrlImage(value = '') {
    const txt = String(value || '').trim();
    const match = txt.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return null;
    return {
        mimeType: match[1],
        buffer: Buffer.from(match[2], 'base64')
    };
}

function extensionFromMimeType(mimeType = '') {
    const cleanMime = String(mimeType || '').toLowerCase();
    if (cleanMime.includes('png')) return 'png';
    if (cleanMime.includes('webp')) return 'webp';
    if (cleanMime.includes('jpeg') || cleanMime.includes('jpg')) return 'jpg';
    return 'png';
}

function countEmbedded(block = null) {
    if (!block || typeof block !== 'object') return 0;
    let count = 0;
    if (String(block?.actorImageUrl || '').trim().startsWith('data:image/')) count += 1;
    const actions = Array.isArray(block?.actions) ? block.actions : [];
    actions.forEach((action) => {
        const frames = Array.isArray(action?.frames) ? action.frames : [];
        frames.forEach((frame) => {
            if (String(frame?.url || '').trim().startsWith('data:image/')) count += 1;
        });
    });
    return count;
}

async function uploadDataUrl(dataUrl, folderId, prefix) {
    const parsed = parseDataUrlImage(dataUrl);
    if (!parsed) return dataUrl;
    const ext = extensionFromMimeType(parsed.mimeType);
    const tempPath = path.join(os.tmpdir(), `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`);
    fs.writeFileSync(tempPath, parsed.buffer);
    try {
        const driveFile = await ProfDrive.uploadFile(`${prefix}.${ext}`, tempPath, folderId);
        return `/api/structure/proxy/${driveFile.id}`;
    } finally {
        try { fs.unlinkSync(tempPath); } catch (_) {}
    }
}

async function migrateAnimationBlock(block, folderId) {
    if (!block || typeof block !== 'object') return { block, changed: false, embeddedBefore: 0, embeddedAfter: 0 };
    const embeddedBefore = countEmbedded(block);
    if (embeddedBefore === 0) return { block, changed: false, embeddedBefore, embeddedAfter: 0 };

    const next = { ...block };
    let changed = false;

    if (String(next.actorImageUrl || '').trim().startsWith('data:image/')) {
        next.actorImageUrl = await uploadDataUrl(next.actorImageUrl, folderId, 'sprite_actor');
        changed = true;
    }

    next.actions = await Promise.all((Array.isArray(next.actions) ? next.actions : []).map(async (action, actionIndex) => {
        const frames = await Promise.all((Array.isArray(action?.frames) ? action.frames : []).map(async (frame, frameIndex) => {
            const url = String(frame?.url || '').trim();
            if (!url.startsWith('data:image/')) return frame;
            changed = true;
            return {
                ...frame,
                url: await uploadDataUrl(url, folderId, `sprite_frame_${actionIndex}_${frameIndex}`)
            };
        }));
        return { ...action, frames };
    }));

    return {
        block: next,
        changed,
        embeddedBefore,
        embeddedAfter: countEmbedded(next)
    };
}

async function main() {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
    ProfDrive.init();
    const folderId = await ProfDrive.getOrCreateFolder('CONDA_EXPOSES_SPRITES');
    const rows = await Expose.find({});

    const summary = {
        documentsScanned: rows.length,
        documentsChanged: 0,
        presentationsChanged: 0,
        animationsChanged: 0,
        embeddedBefore: 0,
        embeddedAfter: 0
    };

    for (const row of rows) {
        let docChanged = false;
        const presentations = Array.isArray(row.presentations) ? row.presentations : [];
        for (let pIndex = 0; pIndex < presentations.length; pIndex += 1) {
            const presentation = presentations[pIndex];
            const animations = Array.isArray(presentation?.spriteAnimations) ? presentation.spriteAnimations : [];
            let presentationChanged = false;
            for (let aIndex = 0; aIndex < animations.length; aIndex += 1) {
                const item = animations[aIndex];
                const migrated = await migrateAnimationBlock(item?.animationBlock || null, folderId);
                summary.embeddedBefore += migrated.embeddedBefore;
                summary.embeddedAfter += migrated.embeddedAfter;
                if (!migrated.changed) continue;
                row.presentations[pIndex].spriteAnimations[aIndex].animationBlock = migrated.block;
                presentationChanged = true;
                docChanged = true;
                summary.animationsChanged += 1;
            }
            if (presentationChanged) {
                row.presentations[pIndex].updatedAt = new Date();
                summary.presentationsChanged += 1;
            }
        }
        if (docChanged) {
            await row.save();
            summary.documentsChanged += 1;
        }
    }

    console.log(JSON.stringify(summary, null, 2));
    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error(error);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
});
