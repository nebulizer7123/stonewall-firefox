'use strict';

const USAGE_KEY = 'usage';
let usageData = { totals: {}, sessions: [] };
let current = null; // {domain, start}

async function loadUsageData() {
  const data = await browser.storage.local.get(USAGE_KEY);
  usageData = data[USAGE_KEY] || { totals: {}, sessions: [] };
  for (const info of Object.values(usageData.totals)) {
    if (!Object.prototype.hasOwnProperty.call(info, 'count')) info.count = 0;
  }
}

function saveUsageData() {
  return browser.storage.local.set({ [USAGE_KEY]: usageData });
}

function startSession(domain) {
  if (current && current.domain === domain) return;
  stopSession();
  const now = Date.now();
  let info = usageData.totals[domain];
  if (!info) info = usageData.totals[domain] = { total: 0, last: 0, count: 0 };
  if (!info.last || now - info.last >= 30000) {
    info.count += 1;
  }
  current = { domain, start: now };
}

function stopSession() {
  if (!current) return;
  const end = Date.now();
  const dur = end - current.start;
  let info = usageData.totals[current.domain];
  if (!info) info = usageData.totals[current.domain] = { total: 0, last: 0, count: 0 };
  info.total += dur;
  info.last = end;
  usageData.sessions.push({ domain: current.domain, start: current.start, end });
  current = null;
  saveUsageData();
}

function shouldTrack() {
  if (typeof state !== 'undefined' && state.breakUntil && Date.now() < state.breakUntil) return false;
  return true;
}

async function handleActiveTab(tabId) {
  if (!shouldTrack()) { stopSession(); return; }
  try {
    const tab = await browser.tabs.get(tabId);
    if (!tab.active) return;
    const url = tab.url || '';
    const domain = new URL(url).hostname;
    startSession(domain);
  } catch (e) {
    stopSession();
  }
}

browser.tabs.onActivated.addListener(info => handleActiveTab(info.tabId));

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.active) return;
  if (changeInfo.url || changeInfo.status === 'complete') {
    handleActiveTab(tabId);
  }
});

browser.windows.onFocusChanged.addListener(winId => {
  if (winId === browser.windows.WINDOW_ID_NONE) {
    stopSession();
  } else {
    browser.tabs.query({ active: true, windowId: winId }).then(tabs => {
      if (tabs.length) handleActiveTab(tabs[0].id); else stopSession();
    });
  }
});

browser.idle.onStateChanged.addListener(state => {
  if (state === 'active') {
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (tabs.length) handleActiveTab(tabs[0].id);
    });
  } else {
    stopSession();
  }
});

browser.runtime.onMessage.addListener(msg => {
  if (msg.type === 'start-break') stopSession();
});

loadUsageData().then(() => {
  browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    if (tabs.length) handleActiveTab(tabs[0].id);
  });
});
