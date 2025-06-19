let blockedList = [];
let timeSpent = {};
let currentDomain = null;

async function cleanPomodoro() {
  const now = Date.now();
  const newList = blockedList.filter(e => !(e.pomodoro && now >= e.until));
  if (newList.length !== blockedList.length) {
    blockedList = newList;
    await browser.storage.local.set({blocked: blockedList});
  }
}

async function loadData() {
  const data = await browser.storage.local.get({blocked: [], timeSpent: {}});
  blockedList = data.blocked;
  timeSpent = data.timeSpent;
}

loadData();

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.blocked) blockedList = changes.blocked.newValue;
    if (changes.timeSpent) timeSpent = changes.timeSpent.newValue;
  }
});

function inSchedule(entry) {
  if (!entry.start || !entry.end) return true;
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = entry.start.split(':').map(Number);
  const [eh, em] = entry.end.split(':').map(Number);
  const startM = sh * 60 + sm;
  const endM = eh * 60 + em;
  if (startM <= endM) {
    return minutes >= startM && minutes <= endM;
  } else {
    return minutes >= startM || minutes <= endM;
  }
}

function isBlocked(url) {
  const now = Date.now();
  for (const entry of blockedList) {
    if (entry.pomodoro && now >= entry.until) continue;
    if (url.startsWith(entry.pattern)) {
      if (entry.pomodoro) return true;
      if (inSchedule(entry)) return true;
    }
  }
  return false;
}

browser.webNavigation.onCommitted.addListener((details) => {
  if (isBlocked(details.url)) {
    browser.tabs.update(details.tabId, {url: 'about:blank'});
  }
});

browser.contextMenus.create({
  id: 'stonewall-block',
  title: 'Block this page',
  contexts: ['page'],
  icons: {
    16: 'trowel.png',
    32: 'trowel.png'
  }
});

async function addBlock(url) {
  const data = await browser.storage.local.get({blocked: []});
  data.blocked.push({pattern: url, start: null, end: null});
  await browser.storage.local.set({blocked: data.blocked});
}

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'stonewall-block' && tab) {
    addBlock(tab.url);
  }
});

setInterval(async () => {
  const tabs = await browser.tabs.query({active: true, currentWindow: true});
  if (!tabs[0] || !tabs[0].url.startsWith('http')) return;
  const domain = new URL(tabs[0].url).hostname;
  if (currentDomain === null) currentDomain = domain;
  if (domain === currentDomain) {
    timeSpent[domain] = (timeSpent[domain] || 0) + 1;
  } else {
    currentDomain = domain;
  }
  await browser.storage.local.set({timeSpent});
  await cleanPomodoro();
}, 1000);
