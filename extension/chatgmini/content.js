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

let overlayRoot = null;
let overlayFrame = null;
let overlayStatus = null;

function postChatStatus(detail = "", status = "overlay_status") {
  window.postMessage(
    {
      source: "chatgmini-extension",
      type: "CHATGMINI_CHAT_STATUS",
      requestId: "",
      status,
      detail: String(detail || "")
    },
    "*"
  );
}

function ensureOverlay() {
  if (overlayRoot?.isConnected) return;

  overlayRoot = document.createElement("div");
  overlayRoot.id = "chatgmini-overlay-root";
  overlayRoot.style.position = "fixed";
  overlayRoot.style.top = "18px";
  overlayRoot.style.right = "18px";
  overlayRoot.style.width = "420px";
  overlayRoot.style.height = "78vh";
  overlayRoot.style.zIndex = "2147483646";
  overlayRoot.style.display = "none";
  overlayRoot.style.borderRadius = "24px";
  overlayRoot.style.overflow = "hidden";
  overlayRoot.style.boxShadow = "0 24px 60px rgba(15,23,42,0.25)";
  overlayRoot.style.border = "1px solid rgba(251,207,232,0.9)";
  overlayRoot.style.background = "rgba(255,255,255,0.98)";
  overlayRoot.style.backdropFilter = "blur(10px)";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.padding = "12px 14px";
  header.style.background = "linear-gradient(180deg,#fff7ed 0%,#ffffff 100%)";
  header.style.borderBottom = "1px solid #fde68a";

  const title = document.createElement("div");
  title.textContent = "Gemini Overlay Test";
  title.style.font = "900 14px/1.2 ui-sans-serif, system-ui, sans-serif";
  title.style.color = "#111827";

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "×";
  close.style.width = "34px";
  close.style.height = "34px";
  close.style.border = "none";
  close.style.borderRadius = "12px";
  close.style.cursor = "pointer";
  close.style.font = "900 24px/1 ui-sans-serif, system-ui, sans-serif";
  close.style.background = "#e2e8f0";
  close.style.color = "#334155";
  close.addEventListener("click", () => {
    overlayRoot.style.display = "none";
    postChatStatus("Overlay Gemini ferme.", "overlay_closed");
  });

  header.appendChild(title);
  header.appendChild(close);

  overlayStatus = document.createElement("div");
  overlayStatus.style.padding = "10px 14px";
  overlayStatus.style.font = "700 12px/1.4 ui-sans-serif, system-ui, sans-serif";
  overlayStatus.style.color = "#92400e";
  overlayStatus.style.background = "#fffbeb";
  overlayStatus.style.borderBottom = "1px solid #fde68a";
  overlayStatus.textContent = "Tentative de chargement de Gemini dans l'overlay...";

  overlayFrame = document.createElement("iframe");
  overlayFrame.src = "https://gemini.google.com/app";
  overlayFrame.title = "Gemini Overlay";
  overlayFrame.referrerPolicy = "no-referrer";
  overlayFrame.allow = "clipboard-read; clipboard-write";
  overlayFrame.style.width = "100%";
  overlayFrame.style.height = "calc(100% - 90px)";
  overlayFrame.style.border = "0";
  overlayFrame.style.background = "#fff";
  overlayFrame.addEventListener("load", () => {
    overlayStatus.textContent = "Iframe chargee. Si Gemini reste bloque, Google refuse probablement l'embed.";
    postChatStatus("Overlay Gemini ouvert. Verifie si le vrai chat charge dans le cadre.", "overlay_opened");
  });

  overlayRoot.appendChild(header);
  overlayRoot.appendChild(overlayStatus);
  overlayRoot.appendChild(overlayFrame);
  document.documentElement.appendChild(overlayRoot);
}

document.addEventListener("CHATGMINI_OPEN_GEMINI", (event) => {
  const blocked = document.documentElement?.getAttribute('data-chatgmini-open-blocked') === 'true';
  const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
  chrome.runtime.sendMessage({ type: "CHATGMINI_OPEN_GEMINI", blocked, layout: detail.layout || null }, (response) => {
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
