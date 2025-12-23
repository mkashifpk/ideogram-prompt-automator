const elements = {
  fileInput: document.getElementById("fileInput"),
  promptInput: document.getElementById("promptInput"),
  inputSelector: document.getElementById("inputSelector"),
  buttonSelector: document.getElementById("buttonSelector"),
  typingSpeed: document.getElementById("typingSpeed"),
  typingSpeedValue: document.getElementById("typingSpeedValue"),
  delayBetween: document.getElementById("delayBetween"),
  delayBetweenValue: document.getElementById("delayBetweenValue"),
  startBtn: document.getElementById("startBtn"),
  stopBtn: document.getElementById("stopBtn"),
  cancelBtn: document.getElementById("cancelBtn"),
  statusText: document.getElementById("statusText"),
  progressText: document.getElementById("progressText")
};

const DEFAULTS = {
  typingSpeed: 20,
  delayBetween: 1500,
  inputSelector: "",
  buttonSelector: ""
};

let lastStatus = {
  running: false,
  paused: false,
  index: 0,
  total: 0,
  error: null
};

function parsePrompts(text) {
  return text
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function updateSpeedLabels() {
  elements.typingSpeedValue.textContent = elements.typingSpeed.value;
  elements.delayBetweenValue.textContent = elements.delayBetween.value;
}

function renderStatus() {
  let statusLabel = "Idle";
  if (lastStatus.error) {
    statusLabel = `Error: ${lastStatus.error}`;
  } else if (lastStatus.running && !lastStatus.paused) {
    statusLabel = "Running";
  } else if (lastStatus.paused) {
    statusLabel = "Paused";
  } else if (lastStatus.total > 0 && lastStatus.index >= lastStatus.total) {
    statusLabel = "Done";
  }

  elements.statusText.textContent = statusLabel;
  elements.progressText.textContent = `${lastStatus.index} / ${lastStatus.total}`;

  elements.startBtn.textContent = lastStatus.paused ? "Resume" : "Start";
  elements.stopBtn.disabled = !lastStatus.running || lastStatus.paused;
  elements.cancelBtn.disabled = !lastStatus.running && !lastStatus.paused;
}

async function getActiveTabId() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id;
}

async function ensureContentScript(tabId) {
  const [probe] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => Boolean(window.promptAutomatorState)
  });

  if (!probe?.result) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
  }
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

async function syncStatus() {
  const tabId = await getActiveTabId();
  if (!tabId) {
    return;
  }
  try {
    await ensureContentScript(tabId);
    const response = await sendTabMessage(tabId, { type: "status_request" });
    if (response?.status) {
      lastStatus = response.status;
      renderStatus();
    }
  } catch (error) {
    elements.statusText.textContent = "No access";
  }
}

elements.fileInput.addEventListener("change", () => {
  const file = elements.fileInput.files?.[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    elements.promptInput.value = String(reader.result || "");
  };
  reader.readAsText(file);
});

elements.typingSpeed.addEventListener("input", updateSpeedLabels);
elements.delayBetween.addEventListener("input", updateSpeedLabels);

elements.startBtn.addEventListener("click", async () => {
  const tabId = await getActiveTabId();
  if (!tabId) {
    elements.statusText.textContent = "No active tab";
    return;
  }

  try {
    await ensureContentScript(tabId);

    if (lastStatus.paused) {
      await sendTabMessage(tabId, { type: "resume" });
      return;
    }

    const prompts = parsePrompts(elements.promptInput.value);
    if (!prompts.length) {
      elements.statusText.textContent = "Add prompts first";
      return;
    }

    const payload = {
      type: "start",
      prompts,
      inputSelector: elements.inputSelector.value.trim(),
      buttonSelector: elements.buttonSelector.value.trim(),
      typingSpeed: Number(elements.typingSpeed.value),
      delayBetween: Number(elements.delayBetween.value)
    };

    await chrome.storage.local.set({
      typingSpeed: payload.typingSpeed,
      delayBetween: payload.delayBetween,
      inputSelector: payload.inputSelector,
      buttonSelector: payload.buttonSelector
    });

    await sendTabMessage(tabId, payload);
  } catch (error) {
    elements.statusText.textContent = "Failed to start";
  }
});

elements.stopBtn.addEventListener("click", async () => {
  const tabId = await getActiveTabId();
  if (!tabId) {
    return;
  }
  try {
    await ensureContentScript(tabId);
    await sendTabMessage(tabId, { type: "stop" });
  } catch (error) {
    elements.statusText.textContent = "Failed to stop";
  }
});

elements.cancelBtn.addEventListener("click", async () => {
  const tabId = await getActiveTabId();
  if (!tabId) {
    return;
  }
  try {
    await ensureContentScript(tabId);
    await sendTabMessage(tabId, { type: "cancel" });
  } catch (error) {
    elements.statusText.textContent = "Failed to cancel";
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "status") {
    lastStatus = message.status;
    renderStatus();
  }
});

async function restoreSettings() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  elements.typingSpeed.value = stored.typingSpeed ?? DEFAULTS.typingSpeed;
  elements.delayBetween.value = stored.delayBetween ?? DEFAULTS.delayBetween;
  elements.inputSelector.value = stored.inputSelector ?? "";
  elements.buttonSelector.value = stored.buttonSelector ?? "";
  updateSpeedLabels();
}

restoreSettings().then(syncStatus);
