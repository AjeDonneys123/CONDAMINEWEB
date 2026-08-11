const HORN_STATE_KEY = '__condawebDevCompletionHorn';

const getHornState = () => {
  if (!window[HORN_STATE_KEY]) {
    window[HORN_STATE_KEY] = { context: null, unlocked: false, registered: false };
  }
  return window[HORN_STATE_KEY];
};

const ensureAudioContext = async () => {
  const state = getHornState();
  if (!state.context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    state.context = new AudioContextClass();
  }
  if (state.context.state === 'suspended') await state.context.resume();
  state.unlocked = state.context.state === 'running';
  return state.context;
};

const playCompletionHorn = async () => {
  const state = getHornState();
  if (!state.unlocked) return;
  const context = await ensureAudioContext().catch(() => null);
  if (!context) return;

  const start = context.currentTime + 0.02;
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, start);
  master.gain.exponentialRampToValueAtTime(0.42, start + 0.025);
  master.gain.setValueAtTime(0.42, start + 0.62);
  master.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
  master.connect(context.destination);

  [196, 247, 294].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const voiceGain = context.createGain();
    oscillator.type = index === 0 ? 'sawtooth' : 'square';
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.linearRampToValueAtTime(frequency * 0.86, start + 0.9);
    voiceGain.gain.value = index === 0 ? 0.55 : 0.18;
    oscillator.connect(voiceGain);
    voiceGain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + 0.92);
  });
};

export const installDevCompletionHorn = () => {
  if (!import.meta.env.DEV || !import.meta.hot) return;
  const state = getHornState();
  if (state.registered) return;
  state.registered = true;

  const unlock = () => ensureAudioContext().catch(() => null);
  window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  window.addEventListener('keydown', unlock, { once: true, capture: true });

  // Le son n'est plus lié aux mises à jour HMR intermédiaires : il ne doit
  // retentir que lorsqu'une fin de travail est explicitement annoncée.
  window.addEventListener('condaweb:completion-horn', () => {
    playCompletionHorn();
  });
};
