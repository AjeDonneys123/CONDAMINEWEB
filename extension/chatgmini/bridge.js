(function chatgminiBridge() {
  window.__condaGeminiExtension = true;
  window.__condaGeminiExtensionName = "chatgmini";

  window.ChatGmini = {
    openGemini() {
      window.postMessage(
        {
          source: "condaweb-page",
          type: "CHATGMINI_OPEN_GEMINI"
        },
        "*"
      );
    }
  };
})();
