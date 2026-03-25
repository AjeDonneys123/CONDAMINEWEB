const API_PROXY_RE = /\/api\/(?:prof\/)?structure\/proxy\/([^/?#]+)/i;
const API_RAW_RE = /\/api\/proxy\/([^/?#]+)/i;
const GOOGLE_FILE_RE = /drive\.google\.com\/file\/d\/([^/?#]+)/i;
const GOOGLE_UC_RE = /[?&]id=([^&#]+)/i;
const DEFAULT_BACKEND_ORIGIN = 'https://hgeoentraineur.onrender.com';

function getBackendOrigin() {
    if (typeof window === 'undefined') return '';
    const origin = String(window.location.origin || '').trim();
    const host = String(window.location.hostname || '').trim().toLowerCase();
    if (host.includes('vercel.app')) return DEFAULT_BACKEND_ORIGIN;
    return origin;
}

export function extractDriveFileId(url) {
    if (!url || typeof url !== 'string') return null;

    const raw = url.trim();
    if (!raw) return null;

    let match = raw.match(API_RAW_RE);
    if (match?.[1]) return decodeURIComponent(match[1]);

    match = raw.match(API_PROXY_RE);
    if (match?.[1]) return decodeURIComponent(match[1]);

    match = raw.match(GOOGLE_FILE_RE);
    if (match?.[1]) return decodeURIComponent(match[1]);

    if (raw.includes('googleusercontent.com') || raw.includes('googleapis.com') || raw.includes('drive.google.com/uc')) {
        match = raw.match(GOOGLE_UC_RE);
        if (match?.[1]) return decodeURIComponent(match[1]);
    }

    return null;
}

export function resolveDriveAssetUrl(url) {
    if (!url || typeof url !== 'string') return "";

    const raw = url.trim();
    if (!raw) return "";
    if (raw.startsWith('blob:') || raw.startsWith('data:')) return raw;
    if (raw.startsWith('/api/proxy/')) return raw;

    const id = extractDriveFileId(raw);
    if (!id) {
        console.warn(`[driveUrl] Unable to extract fileId from: ${raw}`);
        return raw;
    }
    return `/api/proxy/${id}`;
}

export function resolveDriveVideoUrl(url) {
    if (!url || typeof url !== 'string') return "";
    const raw = url.trim();
    if (!raw) return "";
    if (raw.startsWith('blob:') || raw.startsWith('data:')) return raw;
    if (raw.startsWith('/api/proxy/')) return raw;

    const id = extractDriveFileId(raw);
    if (!id) return raw;

    // For video playback, prefer direct Google file stream when possible.
    // This avoids routing all bytes through the app proxy (can stutter on small servers).
    return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
}

export function resolveBackendAssetUrl(url) {
    if (!url || typeof url !== 'string') return "";
    const raw = url.trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw) || raw.startsWith('blob:') || raw.startsWith('data:')) return raw;
    if (raw.startsWith('/uploads/')) {
        const backendOrigin = getBackendOrigin();
        return backendOrigin ? `${backendOrigin}${raw}` : raw;
    }
    return raw;
}
