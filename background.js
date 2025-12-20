// background.js

const ICON_SIZES = [16, 32];
let PURPLE_ICON = null;

function makePurpleIcon() {
  const result = {};

  for (const size of ICON_SIZES) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext("2d");

    // Purple background
    ctx.fillStyle = "#C8A2C8";
    ctx.fillRect(0, 0, size, size);

    // Draw white "P"
    ctx.fillStyle = "#ffffff";
    ctx.font = `${Math.floor(size * 0.8)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("P", size / 2, size / 2 + size * 0.05);

    result[size] = ctx.getImageData(0, 0, size, size);
  }

  return result;
}

function ensurePurpleIcon() {
  if (!PURPLE_ICON) PURPLE_ICON = makePurpleIcon();
}

chrome.runtime.onInstalled.addListener(() => {
  ensurePurpleIcon();
  chrome.action.setIcon({ imageData: PURPLE_ICON });
});

chrome.runtime.onStartup.addListener(() => {
  ensurePurpleIcon();
  chrome.action.setIcon({ imageData: PURPLE_ICON });
});


// Keep reading mode state per tab
const readingModeByTab = {};

// Cleanup when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  delete readingModeByTab[tabId];
});

// Clicking the extension icon toggles reading mode
chrome.action.onClicked.addListener((tab) => {
  if (!tab || !tab.id) return;

  const tabId = tab.id;

  if (tab.url && tab.url.includes("pep-web.org")) {

    // Flip state
    const newState = !readingModeByTab[tabId];
    readingModeByTab[tabId] = newState;

    // Notify content.js
    chrome.tabs.sendMessage(
      tabId,
      { type: "pep/toggleReadingMode", state: newState },
      () => void chrome.runtime.lastError
    );

  } else {
    chrome.action.setBadgeText({ tabId, text: "" });
  }
});

// Keyboard shortcut for popup stays the same
chrome.commands.onCommand.addListener((command) => {
  console.log("[PEP] command fired:", command);
  if (command !== "toggle-search-popup") return;

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab || !tab.id) return;
    if (!tab.url.includes("pep-web.org")) return;

    chrome.tabs.sendMessage(
      tab.id,
      { action: "toggleSearchPopup" },
      () => void chrome.runtime.lastError
    );
  });
});