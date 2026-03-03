const STORAGE_KEY = 'conda_video_segments_v1';

const safeParse = (raw) => {
    try {
        const data = JSON.parse(raw || '{}');
        return data && typeof data === 'object' ? data : {};
    } catch (_) {
        return {};
    }
};

const loadStore = () => {
    if (typeof window === 'undefined') return {};
    return safeParse(window.localStorage.getItem(STORAGE_KEY));
};

const saveStore = (store) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store || {}));
};

export const normalizeVideoUrl = (url = '') => {
    const raw = String(url || '').trim();
    if (!raw) return '';
    try {
        const u = new URL(raw, window.location.origin);
        ['start', 'end', 't'].forEach((k) => u.searchParams.delete(k));
        return u.toString();
    } catch (_) {
        return raw;
    }
};

export const getVideoSegments = (url = '') => {
    const key = normalizeVideoUrl(url);
    if (!key) return [];
    const store = loadStore();
    const list = Array.isArray(store[key]) ? store[key] : [];
    return list.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
};

export const saveVideoSegment = (url = '', segment = {}) => {
    const key = normalizeVideoUrl(url);
    if (!key) return null;
    const store = loadStore();
    const list = Array.isArray(store[key]) ? store[key] : [];
    const next = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        label: String(segment.label || '').trim(),
        startSec: Math.max(0, Number(segment.startSec || 0)),
        endSec: Math.max(0, Number(segment.endSec || 0)),
        order: list.length + 1,
        createdAt: new Date().toISOString()
    };
    store[key] = [...list, next];
    saveStore(store);
    return next;
};

export const deleteVideoSegment = (url = '', segmentId = '') => {
    const key = normalizeVideoUrl(url);
    const sid = String(segmentId || '').trim();
    if (!key || !sid) return false;
    const store = loadStore();
    const list = Array.isArray(store[key]) ? store[key] : [];
    const next = list.filter((s) => String(s?.id || '') !== sid);
    if (next.length === list.length) return false;
    store[key] = next.map((s, i) => ({ ...s, order: i + 1 }));
    saveStore(store);
    return true;
};

export const applySegmentToUrl = (url = '', segment = null) => {
    const raw = String(url || '').trim();
    if (!raw || !segment) return raw;
    try {
        const u = new URL(raw, window.location.origin);
        const start = Math.max(0, Number(segment.startSec || 0));
        const end = Math.max(0, Number(segment.endSec || 0));
        if (start > 0) u.searchParams.set('start', String(Math.floor(start)));
        else u.searchParams.delete('start');
        if (end > start) u.searchParams.set('end', String(Math.floor(end)));
        else u.searchParams.delete('end');
        return u.toString();
    } catch (_) {
        return raw;
    }
};
