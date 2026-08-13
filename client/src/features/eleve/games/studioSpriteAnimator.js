const normalizeActionName = (value = '') => String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

export function createStudioSpriteAnimator(image, actor) {
    let timer = null;
    let playToken = 0;

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
        const frames = (action?.frames || []).map((frame) => frame?.url).filter(Boolean);
        if (!image || frames.length === 0) {
            if (!loop && onComplete) onComplete();
            return false;
        }

        stop();
        const token = playToken;
        let index = 0;
        image.src = frames[0];
        if (frames.length === 1) {
            if (!loop && onComplete) onComplete();
            return true;
        }

        const speed = Math.max(40, Math.min(2000, Number(action?.speed) || 100));
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
            image.src = frames[index];
        }, speed);
        return true;
    };

    return { play, stop, has: (names) => Boolean(findAction(names)) };
}
