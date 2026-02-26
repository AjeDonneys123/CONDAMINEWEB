let sharpLib = null;
try {
    // Optional dependency: if unavailable, fallback keeps original image.
    sharpLib = require('sharp');
} catch (_) {
    sharpLib = null;
}

const DEFAULT_UPSCALE = 1.7;

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const getBufferFromB64 = (base64Image = '') => Buffer.from(String(base64Image || ''), 'base64');
const getB64FromBuffer = (buffer) => Buffer.from(buffer).toString('base64');

const preprocessForScan = async (base64Image = '', options = {}) => {
    const startedAt = Date.now();
    const upscale = clamp(Number(options.upscale || DEFAULT_UPSCALE), 1, 2);
    const result = {
        ok: true,
        usedSharp: Boolean(sharpLib),
        originalB64: String(base64Image || ''),
        preprocessedB64: String(base64Image || ''),
        meta: {
            original: {},
            preprocessed: {},
            ms: 0
        }
    };

    if (!base64Image) {
        result.ok = false;
        result.meta.ms = Date.now() - startedAt;
        return result;
    }

    if (!sharpLib) {
        result.meta.ms = Date.now() - startedAt;
        return result;
    }

    try {
        const sharp = sharpLib;
        const inputBuffer = getBufferFromB64(base64Image);
        const input = sharp(inputBuffer, { failOnError: false });
        const meta = await input.metadata();
        const width = Number(meta.width || 0);
        const height = Number(meta.height || 0);
        result.meta.original = { width, height, size: inputBuffer.length };

        const targetWidth = width > 0 ? Math.round(width * upscale) : null;
        const targetHeight = height > 0 ? Math.round(height * upscale) : null;

        let pipeline = sharp(inputBuffer, { failOnError: false })
            .greyscale()
            .linear(1.2, -10)
            .median(1)
            .sharpen({ sigma: 0.8, m1: 0.5, m2: 1.2 });

        if (targetWidth && targetHeight) {
            pipeline = pipeline.resize(targetWidth, targetHeight, { fit: 'fill', kernel: sharp.kernel.lanczos3 });
        }

        const outBuffer = await pipeline.jpeg({ quality: 96, mozjpeg: true }).toBuffer();
        const outMeta = await sharp(outBuffer).metadata();
        result.preprocessedB64 = getB64FromBuffer(outBuffer);
        result.meta.preprocessed = {
            width: Number(outMeta.width || 0),
            height: Number(outMeta.height || 0),
            size: outBuffer.length
        };
        result.meta.ms = Date.now() - startedAt;
        return result;
    } catch (e) {
        return {
            ...result,
            ok: false,
            preprocessedB64: String(base64Image || ''),
            error: e.message,
            meta: { ...result.meta, ms: Date.now() - startedAt }
        };
    }
};

const splitIntoZones = async (base64Image = '', options = {}) => {
    const zones = [];
    if (!base64Image || !sharpLib) return zones;
    try {
        const sharp = sharpLib;
        const source = getBufferFromB64(base64Image);
        const meta = await sharp(source, { failOnError: false }).metadata();
        const width = Number(meta.width || 0);
        const height = Number(meta.height || 0);
        if (!width || !height) return zones;

        const zoneCount = Math.max(3, Math.min(6, Number(options.zoneCount || 4)));
        const topMargin = Math.round(height * 0.14); // ignore header area
        const bottomMargin = Math.round(height * 0.05);
        const usableHeight = Math.max(1, height - topMargin - bottomMargin);
        const zoneHeight = Math.max(30, Math.floor(usableHeight / zoneCount));

        for (let i = 0; i < zoneCount; i += 1) {
            const top = topMargin + (i * zoneHeight);
            if (top >= height) break;
            const h = Math.min(zoneHeight + 16, height - top);
            const crop = await sharp(source, { failOnError: false })
                .extract({ left: 0, top, width, height: h })
                .jpeg({ quality: 96, mozjpeg: true })
                .toBuffer();
            zones.push({
                idx: i,
                top,
                height: h,
                b64: getB64FromBuffer(crop)
            });
        }
        return zones;
    } catch (_) {
        return [];
    }
};

module.exports = { preprocessForScan, splitIntoZones };
