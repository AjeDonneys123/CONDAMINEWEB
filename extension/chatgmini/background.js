let geminiTabId = null;
let geminiWindowId = null;
let geminiReadyTabId = null;

function loadState(callback) {
  chrome.storage.local.get(["chatgmini_geminiTabId", "chatgmini_geminiWindowId", "chatgmini_requests"], (data) => {
    callback({
      geminiTabId: Number(data?.chatgmini_geminiTabId || 0) || null,
      geminiWindowId: Number(data?.chatgmini_geminiWindowId || 0) || null,
      requests: data?.chatgmini_requests && typeof data.chatgmini_requests === "object" ? data.chatgmini_requests : {}
    });
  });
}

function saveGeminiLocation(tabId, windowId, callback = () => {}) {
  geminiTabId = tabId || null;
  geminiWindowId = windowId || null;
  if (!geminiTabId) {
    geminiReadyTabId = null;
  }
  chrome.storage.local.set({
    chatgmini_geminiTabId: geminiTabId || null,
    chatgmini_geminiWindowId: geminiWindowId || null
  }, callback);
}

function saveRequestTarget(requestId, target) {
  if (!requestId) return;
  loadState((state) => {
    const requests = { ...state.requests, [requestId]: target };
    chrome.storage.local.set({ chatgmini_requests: requests }, () => {});
  });
}

function consumeRequestTarget(requestId, callback) {
  if (!requestId) {
    callback(null);
    return;
  }
  loadState((state) => {
    const target = state.requests[requestId] || null;
    if (!target) {
      callback(null);
      return;
    }
    const requests = { ...state.requests };
    delete requests[requestId];
    chrome.storage.local.set({ chatgmini_requests: requests }, () => callback(target));
  });
}

function ensureGeminiTab({ focus = false, createIfMissing = false } = {}, callback) {
  const fallbackQuery = () => {
    chrome.tabs.query({ url: "https://gemini.google.com/*" }, (tabs) => {
      const existing = (tabs || []).find((tab) => tab?.id);
      if (existing?.id) {
        saveGeminiLocation(existing.id, existing.windowId, () => {
          if (!focus) {
            callback(existing.id);
            return;
          }
          chrome.windows.update(existing.windowId, { focused: true, state: "maximized" }, () => {
            chrome.tabs.update(existing.id, { active: true }, () => callback(existing.id));
          });
        });
        return;
      }
      if (!createIfMissing) {
        callback(null);
        return;
      }
      chrome.windows.create(
        {
          url: "https://gemini.google.com/app",
          type: "popup",
          focused: true,
          width: 420,
          height: 620,
          left: 24,
          top: 24
        },
        (win) => {
          const tab = win?.tabs?.find((item) => item?.id);
          if (chrome.runtime.lastError || !tab?.id) {
            callback(null);
            return;
          }
          saveGeminiLocation(tab.id, win?.id, () => callback(tab.id));
        }
      );
    });
  };

  const withTabId = (tabId) => {
    if (!tabId) {
      fallbackQuery();
      return;
    }

    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab?.id) {
        saveGeminiLocation(null, null, () => fallbackQuery());
        return;
      }
      if (!focus) {
        callback(tab.id);
        return;
      }
      chrome.windows.update(tab.windowId, { focused: true }, () => {
        chrome.tabs.update(tab.id, { active: true }, () => callback(tab.id));
      });
    });
  };

  if (geminiTabId) {
    withTabId(geminiTabId);
    return;
  }

  loadState((state) => {
    geminiTabId = state.geminiTabId;
    geminiWindowId = state.geminiWindowId;
    withTabId(geminiTabId);
  });
}

function injectGeminiPageScript(tabId, callback = () => {}) {
  chrome.scripting.executeScript(
    {
      target: { tabId },
      files: ["gemini-page.js"]
    },
    () => {
      callback(!chrome.runtime.lastError);
    }
  );
}

function pingGeminiScript(tabId, callback) {
  chrome.tabs.sendMessage(tabId, { type: "CHATGMINI_GEMINI_PING" }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      callback(false);
      return;
    }
    geminiReadyTabId = tabId;
    callback(true);
  });
}

function waitForGeminiReady(tabId, { requestId = "", sourceTabId = null, mode = "chat", tries = 0 } = {}, callback) {
  if (!tabId) {
    callback(false);
    return;
  }
  pingGeminiScript(tabId, (ready) => {
    if (ready) {
      callback(true);
      return;
    }
    if (tries === 0) {
      injectGeminiPageScript(tabId, () => {});
    }
    if (sourceTabId) {
      chrome.tabs.sendMessage(sourceTabId, {
        type: mode === "chat" ? "CHATGMINI_CHAT_STATUS" : "CHATGMINI_HOMEWORK_STATUS",
        requestId,
        status: "gemini_retry",
        detail: tries >= 4
          ? "Gemini ouvert mais pas encore pret a recevoir."
          : "Connexion au script Gemini..."
      }, () => {});
    }
    if (tries >= 7) {
      callback(false);
      return;
    }
    setTimeout(() => {
      waitForGeminiReady(tabId, { requestId, sourceTabId, mode, tries: tries + 1 }, callback);
    }, 900);
  });
}

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === geminiTabId) {
    saveGeminiLocation(null, null, () => {});
  }
  if (tabId === geminiReadyTabId) {
    geminiReadyTabId = null;
  }
});

function refocusSourceTab(tabId) {
  if (!tabId) return;
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab?.id) return;
    chrome.windows.update(tab.windowId, { focused: true }, () => {
      chrome.tabs.update(tab.id, { active: true }, () => {});
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") return false;

  if (message.type === "CHATGMINI_OPEN_SIDEPANEL") {
    const tabId = sender?.tab?.id;
    if (!tabId || !chrome.sidePanel?.open) {
      sendResponse({ ok: false });
      return false;
    }
    chrome.sidePanel.open({ tabId }, () => {
      sendResponse({ ok: !chrome.runtime.lastError });
    });
    return true;
  }

  if (message.type === "CHATGMINI_OPEN_GEMINI") {
    if (message.blocked) {
      sendResponse({ ok: false, blocked: true });
      return false;
    }
    ensureGeminiTab({ focus: true, createIfMissing: true }, (tabId) => {
      if (!tabId) {
        sendResponse({ ok: false });
        return;
      }
      waitForGeminiReady(tabId, {}, (ready) => {
        sendResponse({ ok: ready });
      });
    });
    return true;
  }

  if (message.type === "CHATGMINI_HOMEWORK_RUN") {
    const sourceTabId = sender?.tab?.id;
    const requestId = String(message.requestId || "");
    const promptText = String(message.promptText || "");
    if (sourceTabId) saveRequestTarget(requestId, { sourceTabId, mode: "homework" });
    ensureGeminiTab({ focus: false, createIfMissing: false }, (tabId) => {
      if (!tabId) {
        if (sourceTabId) {
          chrome.tabs.sendMessage(sourceTabId, {
            type: "CHATGMINI_HOMEWORK_STATUS",
            requestId,
            status: "gemini_missing",
            detail: "Clique sur Ouvrir Gemini, puis reviens ici."
          }, () => {});
        }
        sendResponse({ ok: false, error: "Gemini introuvable." });
        return;
      }
      if (sourceTabId) {
        chrome.tabs.sendMessage(sourceTabId, {
          type: "CHATGMINI_HOMEWORK_STATUS",
          requestId,
          status: "gemini_tab_found",
          detail: "Onglet Gemini trouve."
        }, () => {});
      }
      waitForGeminiReady(tabId, { requestId, sourceTabId, mode: "homework" }, (ready) => {
        if (!ready) {
          sendResponse({ ok: false, error: "Gemini non pret." });
          return;
        }
        chrome.tabs.sendMessage(
          tabId,
          { type: "CHATGMINI_GEMINI_SEND_PROMPT", requestId, promptText },
          () => {
            if (chrome.runtime.lastError) {
              sendResponse({ ok: false, error: "Prompt non transmis." });
              return;
            }
            if (sourceTabId) {
              chrome.tabs.sendMessage(sourceTabId, {
                type: "CHATGMINI_HOMEWORK_STATUS",
                requestId,
                status: "prompt_sent",
                detail: "Message transmis a Gemini."
              }, () => {});
            }
            sendResponse({ ok: true });
          }
        );
      });
    });
    return true;
  }

  if (message.type === "CHATGMINI_CHAT_RUN") {
    const sourceTabId = sender?.tab?.id;
    const requestId = String(message.requestId || "");
    const promptText = String(message.promptText || "");
    if (sourceTabId) saveRequestTarget(requestId, { sourceTabId, mode: "chat" });
    ensureGeminiTab({ focus: false, createIfMissing: false }, (tabId) => {
      if (!tabId) {
        if (sourceTabId) {
          chrome.tabs.sendMessage(sourceTabId, {
            type: "CHATGMINI_CHAT_STATUS",
            requestId,
            status: "gemini_missing",
            detail: "Clique sur Ouvrir Gemini, puis reviens ici."
          }, () => {});
        }
        sendResponse({ ok: false, error: "Gemini introuvable." });
        return;
      }
      if (sourceTabId) {
        chrome.tabs.sendMessage(sourceTabId, {
          type: "CHATGMINI_CHAT_STATUS",
          requestId,
          status: "gemini_tab_found",
          detail: "Onglet Gemini trouve."
        }, () => {});
      }
      waitForGeminiReady(tabId, { requestId, sourceTabId, mode: "chat" }, (ready) => {
        if (!ready) {
          sendResponse({ ok: false, error: "Gemini non pret." });
          return;
        }
        chrome.tabs.sendMessage(
          tabId,
          { type: "CHATGMINI_GEMINI_SEND_PROMPT", requestId, promptText },
          () => {
            if (chrome.runtime.lastError) {
              sendResponse({ ok: false, error: "Prompt non transmis." });
              return;
            }
            if (sourceTabId) {
              chrome.tabs.sendMessage(sourceTabId, {
                type: "CHATGMINI_CHAT_STATUS",
                requestId,
                status: "prompt_sent",
                detail: "Message transmis a Gemini."
              }, () => {});
            }
            sendResponse({ ok: true });
          }
        );
      });
    });
    return true;
  }

  if (message.type === "CHATGMINI_GEMINI_READY") {
    const senderTabId = sender?.tab?.id || null;
    if (senderTabId) {
      geminiReadyTabId = senderTabId;
      if (!geminiTabId) {
        saveGeminiLocation(senderTabId, sender?.tab?.windowId || null, () => {});
      }
    }
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "CHATGMINI_GEMINI_RESPONSE") {
    const requestId = String(message.requestId || "");
    consumeRequestTarget(requestId, (target) => {
      if (target?.sourceTabId) {
        chrome.tabs.sendMessage(target.sourceTabId, {
          type: target.mode === "chat" ? "CHATGMINI_CHAT_RESPONSE" : "CHATGMINI_HOMEWORK_RESPONSE",
          requestId,
          text: String(message.text || "")
        }, () => {});
      }
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === "CHATGMINI_GEMINI_STREAM") {
    const requestId = String(message.requestId || "");
    loadState((state) => {
      const target = state.requests[requestId] || null;
      if (target?.sourceTabId) {
        chrome.tabs.sendMessage(target.sourceTabId, {
          type: target.mode === "chat" ? "CHATGMINI_CHAT_STREAM" : "CHATGMINI_HOMEWORK_RESPONSE",
          requestId,
          text: String(message.text || ""),
          done: Boolean(message.done)
        }, () => {});
      }
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === "CHATGMINI_GEMINI_STATUS") {
    const requestId = String(message.requestId || "");
    loadState((state) => {
      const target = state.requests[requestId] || null;
      if (target?.sourceTabId) {
        chrome.tabs.sendMessage(target.sourceTabId, {
          type: target.mode === "chat" ? "CHATGMINI_CHAT_STATUS" : "CHATGMINI_HOMEWORK_STATUS",
          requestId,
          status: String(message.status || ""),
          detail: String(message.detail || "")
        }, () => {});
      }
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === "CHATGMINI_PING") {
    sendResponse({ ok: true, extension: "chatgmini" });
    return false;
  }

  return false;
});
