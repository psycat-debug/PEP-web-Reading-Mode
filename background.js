// Clicking the extension icon -> send message to current tab
chrome.action.onClicked.addListener((tab) => {
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: 'pep/processOnce' });
});