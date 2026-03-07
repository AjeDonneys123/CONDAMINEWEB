const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const VIDEO_EXTENSIONS = new Set([
    '.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.wmv', '.mpg', '.mpeg'
]);

function isVideoFilename(name = '') {
    const ext = path.extname(String(name || '').toLowerCase());
    return VIDEO_EXTENSIONS.has(ext);
}

function runFfmpeg(args = []) {
    return new Promise((resolve, reject) => {
        const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let err = '';
        proc.stderr.on('data', (chunk) => {
            err += String(chunk || '');
        });
        proc.on('error', (e) => reject(e));
        proc.on('close', (code) => {
            if (code === 0) return resolve(true);
            return reject(new Error(`ffmpeg exit ${code}: ${err.slice(-500)}`));
        });
    });
}

async function transcodeVideoToMp4(inputPath = '') {
    const safeInput = String(inputPath || '').trim();
    if (!safeInput || !fs.existsSync(safeInput)) {
        throw new Error('Input video file not found');
    }
    const dir = path.dirname(safeInput);
    const base = path.basename(safeInput, path.extname(safeInput));
    const outputPath = path.join(dir, `${base}.websafe.mp4`);
    const args = [
        '-y',
        '-i', safeInput,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        outputPath
    ];
    await runFfmpeg(args);
    if (!fs.existsSync(outputPath)) {
        throw new Error('Transcoded file missing');
    }
    return outputPath;
}

async function maybeTranscodeUpload({ localPath = '', originalName = '' }) {
    const srcPath = String(localPath || '').trim();
    const srcName = String(originalName || '').trim();
    if (!srcPath || !srcName || !isVideoFilename(srcName)) {
        return { uploadPath: srcPath, uploadName: srcName, transcoded: false, cleanup: [] };
    }
    try {
        const outputPath = await transcodeVideoToMp4(srcPath);
        const base = path.basename(srcName, path.extname(srcName));
        return {
            uploadPath: outputPath,
            uploadName: `${base}.mp4`,
            transcoded: true,
            cleanup: [outputPath]
        };
    } catch (e) {
        // Fallback original file if ffmpeg is unavailable or conversion fails.
        return { uploadPath: srcPath, uploadName: srcName, transcoded: false, cleanup: [] };
    }
}

module.exports = {
    isVideoFilename,
    maybeTranscodeUpload
};
