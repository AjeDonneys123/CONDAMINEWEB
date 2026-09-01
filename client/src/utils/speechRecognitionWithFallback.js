const DEFAULT_FALLBACK_MS = 8000;

const cleanTranscript = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();

async function transcribeRecordedAudio(blob, durationMs, language) {
  const form = new FormData();
  const extension = String(blob?.type || '').includes('mp4') ? 'm4a' : 'webm';
  form.append('audio', blob, `dictation-${Date.now()}.${extension}`);
  form.append('durationMs', String(Math.max(0, Number(durationMs || 0))));
  form.append('language', String(language || 'fr-FR').split('-')[0]);
  const response = await fetch('/api/eleve/learning/transcribe-audio', { method: 'POST', body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'Transcription de secours impossible.');
  return cleanTranscript(data?.text);
}

async function startRecorderFallback(options, controller) {
  if (!navigator?.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('Aucun micro compatible n’est disponible.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : (MediaRecorder.isTypeSupported?.('audio/mp4') ? 'audio/mp4' : '');
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  const startedAt = Date.now();
  controller.mode = 'fallback';
  controller.recorder = recorder;
  controller.stream = stream;
  options.onFallbackStart?.();
  options.onStart?.('fallback');

  const completion = new Promise((resolve, reject) => {
    recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
    recorder.onerror = () => reject(new Error('Enregistrement du micro impossible.'));
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      try {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const transcript = await transcribeRecordedAudio(blob, Date.now() - startedAt, options.lang);
        if (!transcript) throw new Error('Aucune parole reconnue.');
        options.onResult?.(transcript, { source: 'server', final: true });
        resolve(transcript);
      } catch (error) {
        reject(error);
      }
    };
  });
  recorder.start(250);
  controller.fallbackTimer = window.setTimeout(() => {
    if (recorder.state !== 'inactive') recorder.stop();
  }, Math.max(2000, Number(options.fallbackDurationMs || DEFAULT_FALLBACK_MS)));
  return completion;
}

export function startSpeechRecognitionWithFallback(rawOptions = {}) {
  const options = {
    lang: 'fr-FR',
    continuous: false,
    interimResults: false,
    fallbackDurationMs: DEFAULT_FALLBACK_MS,
    ...rawOptions
  };
  const controller = {
    mode: '', recognition: null, recorder: null, stream: null, fallbackTimer: null, stopped: false,
    stop() {
      this.stopped = true;
      if (this.fallbackTimer) window.clearTimeout(this.fallbackTimer);
      try { this.recognition?.stop?.(); } catch (_) {}
      try { if (this.recorder?.state !== 'inactive') this.recorder?.stop?.(); } catch (_) {}
      this.stream?.getTracks?.().forEach((track) => track.stop());
    }
  };

  const beginFallback = async (nativeError = null) => {
    if (controller.stopped || controller.mode === 'fallback') return;
    try {
      await startRecorderFallback(options, controller);
    } catch (error) {
      options.onError?.(error, { source: 'server', nativeError });
    } finally {
      options.onEnd?.('fallback');
    }
  };

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    void beginFallback(new Error('Reconnaissance native indisponible.'));
    return controller;
  }

  try {
    const recognition = new SpeechRecognition();
    controller.mode = 'native';
    controller.recognition = recognition;
    let receivedText = false;
    let fallbackStarted = false;
    recognition.lang = options.lang;
    recognition.continuous = Boolean(options.continuous);
    recognition.interimResults = Boolean(options.interimResults);
    recognition.maxAlternatives = 1;
    recognition.onstart = () => options.onStart?.('native');
    recognition.onresult = (event) => {
      const transcript = cleanTranscript(Array.from(event.results || []).map((result) => result?.[0]?.transcript || '').join(' '));
      if (!transcript) return;
      receivedText = true;
      const final = Array.from(event.results || []).every((result) => result?.isFinal !== false);
      options.onResult?.(transcript, { source: 'native', final });
    };
    recognition.onerror = (event) => {
      if (controller.stopped || fallbackStarted) return;
      fallbackStarted = true;
      void beginFallback(new Error(event?.error || 'Échec de la reconnaissance native.'));
    };
    recognition.onend = () => {
      if (!controller.stopped && !receivedText && !fallbackStarted) {
        fallbackStarted = true;
        void beginFallback(new Error('Aucune parole reconnue nativement.'));
        return;
      }
      if (!fallbackStarted) options.onEnd?.('native');
    };
    recognition.start();
  } catch (error) {
    void beginFallback(error);
  }
  return controller;
}
