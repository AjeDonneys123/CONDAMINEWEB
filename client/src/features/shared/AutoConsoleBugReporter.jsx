import { useEffect, useRef } from 'react';

const MAX_REPORTS_PER_SESSION = 30;
const DEDUPE_WINDOW_MS = 30000;
const MAX_MESSAGE_LEN = 3000;

const safeStringify = (value) => {
  try {
    if (typeof value === 'string') return value;
    if (value instanceof Error) {
      const stack = value.stack ? `\n${value.stack}` : '';
      return `${value.name || 'Error'}: ${value.message || ''}${stack}`;
    }
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
};

const normalizeArgs = (args = []) =>
  (Array.isArray(args) ? args : [args])
    .map((a) => safeStringify(a))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

export default function AutoConsoleBugReporter({ user }) {
  const sentCountRef = useRef(0);
  const dedupeRef = useRef(new Map());

  useEffect(() => {
    if (!user?.id && !user?._id) return;
    const isProd = Boolean(import.meta?.env?.PROD);
    if (!isProd) return;

    let active = true;
    const originalError = console.error;
    const originalWarn = console.warn;

    const postBug = async (kind = 'error', rawMessage = '', stack = '') => {
      if (!active) return;
      if (sentCountRef.current >= MAX_REPORTS_PER_SESSION) return;

      const message = String(rawMessage || '').trim();
      if (!message) return;
      if (message.includes('/api/admin/bug-reports')) return;

      const signature = `${kind}|${message.slice(0, 220)}`;
      const now = Date.now();
      const prevTs = Number(dedupeRef.current.get(signature) || 0);
      if (prevTs && (now - prevTs) < DEDUPE_WINDOW_MS) return;
      dedupeRef.current.set(signature, now);
      sentCountRef.current += 1;

      const description = [
        `[AUTO-CONSOLE:${kind.toUpperCase()}] ${message}`,
        stack ? `STACK: ${String(stack).slice(0, 1200)}` : '',
        `URL: ${typeof window !== 'undefined' ? window.location.href : ''}`,
        `TS: ${new Date().toISOString()}`
      ].filter(Boolean).join('\n');

      try {
        await fetch('/api/admin/bug-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.id || user?._id,
            description: description.slice(0, MAX_MESSAGE_LEN),
            page: typeof window !== 'undefined' ? window.location.pathname : '',
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
          })
        });
      } catch (_) {}
    };

    console.error = (...args) => {
      const msg = normalizeArgs(args);
      postBug('error', msg);
      originalError.apply(console, args);
    };

    console.warn = (...args) => {
      const msg = normalizeArgs(args);
      postBug('warn', msg);
      originalWarn.apply(console, args);
    };

    const onError = (event) => {
      const msg = String(event?.message || event?.error?.message || 'window.onerror');
      const stack = String(event?.error?.stack || '');
      postBug('uncaught', msg, stack);
    };

    const onUnhandledRejection = (event) => {
      const reason = event?.reason;
      const msg = reason instanceof Error
        ? `${reason.name || 'Error'}: ${reason.message || ''}`
        : safeStringify(reason || 'unhandledrejection');
      const stack = reason instanceof Error ? String(reason.stack || '') : '';
      postBug('promise', msg, stack);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      active = false;
      console.error = originalError;
      console.warn = originalWarn;
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, [user?.id, user?._id]);

  return null;
}

