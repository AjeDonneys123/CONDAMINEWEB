window.postMessage(
  {
    source: "chatgmini-extension",
    type: "CHATGMINI_EXTENSION_READY"
  },
  "*"
);

try {
  document.documentElement.setAttribute("data-chatgmini-extension", "ready");
} catch (_) {}

document.addEventListener("CHATGMINI_OPEN_GEMINI", () => {
  const blocked = document.documentElement?.getAttribute('data-chatgmini-open-blocked') === 'true';
  chrome.runtime.sendMessage({ type: "CHATGMINI_OPEN_GEMINI", blocked }, (response) => {
    const runtimeError = chrome.runtime.lastError;
    const detail = runtimeError
      ? `Extension indisponible: ${runtimeError.message}`
      : response?.blocked
        ? "Sors du plein ecran pour utiliser l'IA."
      : response?.ok
        ? "Gemini est ouvert."
        : "Impossible d'ouvrir Gemini.";
    window.postMessage(
      {
        source: "chatgmini-extension",
        type: "CHATGMINI_CHAT_STATUS",
        requestId: "",
        status: runtimeError ? "extension_error" : response?.blocked ? "gemini_blocked" : response?.ok ? "gemini_opened" : "gemini_open_failed",
        detail
      },
      "*"
    );
  });
});

document.addEventListener("CHATGMINI_OPEN_SIDEPANEL", () => {
  chrome.runtime.sendMessage({ type: "CHATGMINI_OPEN_SIDEPANEL" }, (response) => {
    const runtimeError = chrome.runtime.lastError;
    const detail = runtimeError
      ? `Extension indisponible: ${runtimeError.message}`
      : response?.ok
        ? "Panneau lateral ouvert."
        : "Impossible d'ouvrir le panneau lateral.";
    window.postMessage(
      {
        source: "chatgmini-extension",
        type: "CHATGMINI_CHAT_STATUS",
        requestId: "",
        status: runtimeError ? "extension_error" : response?.ok ? "sidepanel_opened" : "sidepanel_open_failed",
        detail
      },
      "*"
    );
  });
});

document.addEventListener("CHATGMINI_HOMEWORK_RUN", (event) => {
  const detail = event?.detail || {};
  chrome.runtime.sendMessage(
    {
      type: "CHATGMINI_HOMEWORK_RUN",
      requestId: String(detail.requestId || ""),
      promptText: String(detail.promptText || "")
    },
    () => {
      const runtimeError = chrome.runtime.lastError;
      if (!runtimeError) return;
      window.postMessage(
        {
          source: "chatgmini-extension",
          type: "CHATGMINI_HOMEWORK_STATUS",
          requestId: String(detail.requestId || ""),
          status: "extension_error",
          detail: `Extension indisponible: ${runtimeError.message}`
        },
        "*"
      );
    }
  );
});

document.addEventListener("CHATGMINI_CHAT_RUN", (event) => {
  const detail = event?.detail || {};
  chrome.runtime.sendMessage(
    {
      type: "CHATGMINI_CHAT_RUN",
      requestId: String(detail.requestId || ""),
      promptText: String(detail.promptText || "")
    },
    () => {
      const runtimeError = chrome.runtime.lastError;
      if (!runtimeError) return;
      window.postMessage(
        {
          source: "chatgmini-extension",
          type: "CHATGMINI_CHAT_STATUS",
          requestId: String(detail.requestId || ""),
          status: "extension_error",
          detail: `Extension indisponible: ${runtimeError.message}`
        },
        "*"
      );
    }
  );
});

chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== "CHATGMINI_HOMEWORK_RESPONSE") return;
  window.postMessage(
    {
      source: "chatgmini-extension",
      type: "CHATGMINI_HOMEWORK_RESPONSE",
      requestId: String(message.requestId || ""),
      text: String(message.text || "")
    },
    "*"
  );
});

chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== "CHATGMINI_HOMEWORK_STATUS") return;
  window.postMessage(
    {
      source: "chatgmini-extension",
      type: "CHATGMINI_HOMEWORK_STATUS",
      requestId: String(message.requestId || ""),
      status: String(message.status || ""),
      detail: String(message.detail || "")
    },
    "*"
  );
});

chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== "CHATGMINI_CHAT_RESPONSE") return;
  window.postMessage(
    {
      source: "chatgmini-extension",
      type: "CHATGMINI_CHAT_RESPONSE",
      requestId: String(message.requestId || ""),
      text: String(message.text || "")
    },
    "*"
  );
});

chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== "CHATGMINI_CHAT_STREAM") return;
  window.postMessage(
    {
      source: "chatgmini-extension",
      type: "CHATGMINI_CHAT_STREAM",
      requestId: String(message.requestId || ""),
      text: String(message.text || ""),
      done: Boolean(message.done)
    },
    "*"
  );
});

chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== "CHATGMINI_CHAT_STATUS") return;
  window.postMessage(
    {
      source: "chatgmini-extension",
      type: "CHATGMINI_CHAT_STATUS",
      requestId: String(message.requestId || ""),
      status: String(message.status || ""),
      detail: String(message.detail || "")
    },
    "*"
  );
});
