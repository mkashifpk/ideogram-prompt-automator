(() => {
  if (!window.promptAutomatorState) {
    window.promptAutomatorState = {
      running: false,
      paused: false,
      index: 0,
      prompts: [],
      inputSelector: "",
      buttonSelector: "",
      typingSpeed: 20,
      delayBetween: 1500,
      error: null,
      timer: null,
      typingTimer: null
    };
  }

  if (window.promptAutomatorInitialized) {
    return;
  }

  window.promptAutomatorInitialized = true;
  const state = window.promptAutomatorState;

  function clearTimers() {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    if (state.typingTimer) {
      clearTimeout(state.typingTimer);
      state.typingTimer = null;
    }
  }

  function getStatus() {
    return {
      running: state.running,
      paused: state.paused,
      index: state.index,
      total: state.prompts.length,
      error: state.error
    };
  }

  function broadcastStatus() {
    try {
      chrome.runtime.sendMessage({ type: "status", status: getStatus() });
    } catch (error) {
      // Ignore messaging errors when popup is closed.
    }
  }

  function setError(message) {
    state.error = message;
    state.running = false;
    state.paused = false;
    clearTimers();
    broadcastStatus();
  }

  function isVisible(element) {
    return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
  }

  function isEditable(element) {
    return element.isContentEditable;
  }

  function findInputElement(selector) {
    if (selector) {
      const selected = document.querySelector(selector);
      return selected || null;
    }

    const candidates = [
      ...document.querySelectorAll(
        'textarea, input[type="text"], input[type="search"], input:not([type]), [contenteditable="true"], [contenteditable=""]'
      )
    ].filter(isVisible);

    if (!candidates.length) {
      return null;
    }

    candidates.sort((a, b) => {
      const areaA = a.offsetWidth * a.offsetHeight;
      const areaB = b.offsetWidth * b.offsetHeight;
      return areaB - areaA;
    });

    return candidates[0];
  }

  function getButtonScore(button) {
    const label =
      (button.innerText || "").trim() +
      " " +
      (button.getAttribute("aria-label") || "") +
      " " +
      (button.getAttribute("title") || "");
    const text = label.toLowerCase();
    let score = 0;
    if (/(generate|create|make|run|go|submit)/.test(text)) {
      score += 3;
    }
    if (button.tagName.toLowerCase() === "button") {
      score += 1;
    }
    if (button.getAttribute("type") === "submit") {
      score += 1;
    }
    return score;
  }

  function findButtonElement(selector) {
    if (selector) {
      const selected = document.querySelector(selector);
      return selected || null;
    }

    const candidates = [
      ...document.querySelectorAll(
        'button, input[type="button"], input[type="submit"], [role="button"]'
      )
    ].filter(isVisible);

    if (!candidates.length) {
      return null;
    }

    candidates.sort((a, b) => getButtonScore(b) - getButtonScore(a));
    return candidates[0];
  }

  function setNativeValue(element, value) {
    const proto = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
  }

  function applyValue(element, value) {
    if (isEditable(element)) {
      element.textContent = value;
    } else {
      setNativeValue(element, value);
    }
  }

  function fireInputEvents(element) {
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function fireChangeEvents(element) {
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function typeIntoInput(element, text, speed) {
    return new Promise((resolve) => {
      const safeText = text ?? "";
      if (speed <= 0) {
        applyValue(element, safeText);
        fireInputEvents(element);
        fireChangeEvents(element);
        resolve();
        return;
      }

      let index = 0;
      const step = () => {
        if (!state.running || state.paused) {
          resolve();
          return;
        }
        const slice = safeText.slice(0, index + 1);
        applyValue(element, slice);
        fireInputEvents(element);
        index += 1;
        if (index < safeText.length) {
          state.typingTimer = setTimeout(step, speed);
        } else {
          fireChangeEvents(element);
          resolve();
        }
      };

      step();
    });
  }

  async function runNextPrompt() {
    if (!state.running || state.paused) {
      return;
    }

    if (state.index >= state.prompts.length) {
      state.running = false;
      state.paused = false;
      broadcastStatus();
      return;
    }

    const input = findInputElement(state.inputSelector);
    if (!input) {
      setError("Input not found");
      return;
    }

    const button = findButtonElement(state.buttonSelector);
    if (!button) {
      setError("Generate button not found");
      return;
    }

    try {
      input.focus();
      await typeIntoInput(input, state.prompts[state.index], state.typingSpeed);
      if (!state.running || state.paused) {
        broadcastStatus();
        return;
      }
      button.click();
      state.index += 1;
      broadcastStatus();
      state.timer = setTimeout(runNextPrompt, state.delayBetween);
    } catch (error) {
      setError("Failed to enter prompt");
    }
  }

  function startRun(payload) {
    clearTimers();
    state.prompts = payload.prompts || [];
    state.index = 0;
    state.inputSelector = payload.inputSelector || "";
    state.buttonSelector = payload.buttonSelector || "";
    state.typingSpeed =
      typeof payload.typingSpeed === "number" ? payload.typingSpeed : 20;
    state.delayBetween =
      typeof payload.delayBetween === "number" ? payload.delayBetween : 1500;
    state.error = null;
    state.running = true;
    state.paused = false;
    broadcastStatus();
    runNextPrompt();
  }

  function stopRun() {
    if (!state.running) {
      return;
    }
    state.paused = true;
    clearTimers();
    broadcastStatus();
  }

  function resumeRun() {
    if (!state.running || !state.paused) {
      return;
    }
    state.paused = false;
    broadcastStatus();
    runNextPrompt();
  }

  function cancelRun() {
    state.running = false;
    state.paused = false;
    state.index = 0;
    state.error = null;
    clearTimers();
    broadcastStatus();
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message?.type) {
      sendResponse?.({ status: getStatus() });
      return;
    }

    switch (message.type) {
      case "start":
        startRun(message);
        sendResponse?.({ status: getStatus() });
        break;
      case "stop":
        stopRun();
        sendResponse?.({ status: getStatus() });
        break;
      case "resume":
        resumeRun();
        sendResponse?.({ status: getStatus() });
        break;
      case "cancel":
        cancelRun();
        sendResponse?.({ status: getStatus() });
        break;
      case "status_request":
        sendResponse?.({ status: getStatus() });
        break;
      default:
        sendResponse?.({ status: getStatus() });
        break;
    }
  });
})();
