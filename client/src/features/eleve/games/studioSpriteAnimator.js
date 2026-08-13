const normalizeActionName = (value = '') => String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

export function createStudioSpriteAnimator(baseImage, actor) {
    let timer = null;
    let playToken = 0;
    const layers = new Map();

    const allUrls = [...new Set((actor?.actions || [])
        .flatMap((action) => action?.frames || [])
        .map((frame) => frame?.url)
        .filter(Boolean))];

    const ready = Promise.all(allUrls.map((url) => new Promise((resolve) => {
        if (!baseImage?.parentElement) return resolve(null);
        const layer = document.createElement('img');
        layer.className = `${baseImage.className} studio-animation-frame`;
        layer.alt = '';
        layer.draggable = false;
        layer.style.display = 'none';
        layer.style.position = 'absolute';
        layer.style.inset = '0';
        layer.style.width = '100%';
        layer.style.height = '100%';
        layer.style.objectFit = 'contain';
        layer.onload = () => {
            layer.classList.add('is-loaded');
            layers.set(url, layer);
            resolve(layer);
        };
        layer.onerror = () => { layer.remove(); resolve(null); };
        baseImage.parentElement.insertBefore(layer, baseImage);
        layer.src = url;
    })));

    const hideLayers = () => layers.forEach((layer) => { layer.style.display = 'none'; });
    const showFrame = (url) => {
        const layer = layers.get(url);
        if (!layer) return;
        hideLayers();
        baseImage.style.display = 'none';
        layer.style.display = 'block';
    };

    const stop = () => {
        playToken += 1;
        if (timer) clearTimeout(timer);
        timer = null;
    };

    const findAction = (names = []) => {
        const actions = actor?.actions || [];
        for (const name of names.map(normalizeActionName)) {
            const action = actions.find((item) => normalizeActionName(item?.name) === name);
            if (action) return action;
        }
        return null;
    };

    const play = (names, { loop = true, onComplete } = {}) => {
        const action = findAction(names);
        const frames = (action?.frames || []).map((frame) => frame?.url).filter(Boolean);
        if (!baseImage || frames.length === 0) {
            if (!loop && onComplete) onComplete();
            return false;
        }
        stop();
        const token = playToken;
        const speed = Math.max(40, Math.min(2000, Number(action?.speed) || 100));

        ready.then(() => {
            if (token !== playToken) return;
            let index = 0;
            showFrame(frames[index]);
            const advance = () => {
                if (token !== playToken) return;
                index += 1;
                if (index >= frames.length) {
                    if (!loop) {
                        timer = null;
                        if (onComplete) onComplete();
                        return;
                    }
                    index = 0;
                }
                showFrame(frames[index]);
                timer = setTimeout(advance, speed);
            };
            timer = setTimeout(advance, speed);
        });
        return true;
    };

    const destroy = () => {
        stop();
        layers.forEach((layer) => layer.remove());
        layers.clear();
    };

    return { play, stop, destroy, has: (names) => Boolean(findAction(names)) };
}
