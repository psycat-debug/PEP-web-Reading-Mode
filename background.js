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

    // White P
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.floor(size * 0.8)}px system-ui, sans-serif`;
    ctx.fillText("P", size * 0.5, size * 0.57);

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

// Update badge
function updateBadge(tabId, isActive) {
  if (isActive) {
    chrome.action.setBadgeText({ tabId, text: "ON" });
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#4CAF50" }); // Green ON badge
  } else {
    chrome.action.setBadgeText({ tabId, text: "" }); // Remove badge
  }
}

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

    // Update badge
    updateBadge(tabId, newState);

  } else {
    // Optional: show N/A for non-PEP pages
    chrome.action.setBadgeText({ tabId, text: "N/A" });
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#FF0000" });
  }
});

// Keyboard shortcut for popup stays the same
chrome.commands.onCommand.addListener((command) => {
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