const ICON_SIZES = [16, 32];
let PURPLE_ICON = null;

function makePurpleIcon() {
  const result = {};
  for (const size of ICON_SIZES) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#C8A2C8";
    ctx.fillRect(0, 0, size, size);
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

// ==========================================
// 1. 点击插件图标：发送切换阅读模式的消息
// ==========================================
chrome.action.onClicked.addListener((tab) => {
  if (!tab || !tab.id) return;
  chrome.tabs.sendMessage(tab.id, { action: "toggleReadingMode" }, () => {
    if (chrome.runtime.lastError) console.warn("未在此页面检测到 content.js，请确认是否为 pep-web 域名并已刷新页面。");
  });
});

// ==========================================
// 2. 按下快捷键：发送切换 Search Popup 的消息
// ==========================================
chrome.commands.onCommand.addListener((command) => {
  console.log("[PEP] command fired:", command); // 恢复了日志打印
  
  if (command !== "toggle-search-popup") return;
  
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab || !tab.id) return;
    
    // 直接发送消息，如果 content.js 在该页面运行，就会响应并弹出
    chrome.tabs.sendMessage(tab.id, { action: "toggleSearchPopup" }, () => {
        if (chrome.runtime.lastError) {
            console.log("[PEP] 快捷键触发，但当前页面不在适用范围内或未刷新。");
        } else {
            console.log("[PEP] Popup 指令发送成功！");
        }
    });
  });
});