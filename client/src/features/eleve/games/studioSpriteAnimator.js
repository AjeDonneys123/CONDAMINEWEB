const normalizeActionName = (value = '') => String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

export function createStudioSpriteAnimator(image, actor) {
    let timer = null;
    let playToken = 0;
    const frameCache = new Map();

    const preload = (url) => {
        if (frameCache.has(url)) return frameCache.get(url);
        const pending = new Promise((resolve) => {
            const frame = new Image();
            frame.onload = async () => {
                try { if (frame.decode) await frame.decode(); } catch (_) { /* déjà utilisable */ }
                resolve(frame);
            };
            frame.onerror = () => resolve(null);
            frame.src = url;
        });
        frameCache.set(url, pending);
        return pending;
    };

    const stop = () => {
        playToken += 1;
        if (timer) clearInterval(timer);
        timer = null;
    };

    const findAction = (names = []) => {
        const wanted = names.map(normalizeActionName);
        return (actor?.actions || []).find((action) => wanted.includes(normalizeActionName(action?.name)));
    };

    const play = (names, { loop = true, onComplete } = {}) => {
        const action = findAction(names);
        const urls = (action?.frames || []).map((frame) => frame?.url).filter(Boolean);
        if (!image || urls.length === 0) {
            if (!loop && onComplete) onComplete();
            return false;
        }

        stop();
        const token = playToken;
        const speed = Math.max(40, Math.min(2000, Number(action?.speed) || 100));
        Promise.all(urls.map(preload)).then((loaded) => {
            if (token !== playToken) return;
            const frames = loaded.filter(Boolean);
            if (frames.length === 0) {
                if (!loop && onComplete) onComplete();
                return;
            }
            let index = 0;
            image.src = frames[0].src;
            if (frames.length === 1) {
                if (!loop) timer = setTimeout(() => {
                    timer = null;
                    if (token === playToken && onComplete) onComplete();
                }, speed);
                return;
            }

            timer = setInterval(() => {
                if (token !== playToken) return;
                index += 1;
                if (index >= frames.length) {
                    if (loop) index = 0;
                    else {
                        clearInterval(timer);
                        timer = null;
                        if (onComplete) onComplete();
                        return;
                    }
                }
                image.src = frames[index].src;
            }, speed);
        });
        return true;
    };

    return { play, stop, has: (names) => Boolean(findAction(names)) };
}
