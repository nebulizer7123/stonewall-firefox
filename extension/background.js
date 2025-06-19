let lists = [];
let timeSpent = {};
let currentDomain = null;

async function cleanPomodoro() {
  const now = Date.now();
  let changed = false;
  for (const list of lists) {
    if (list.pomodoro && now >= list.pomodoro.until) {
      list.pomodoro = null;
      changed = true;
    }
  }
  if (changed) {
    await browser.storage.local.set({lists});
  }
}

function inSchedule(list) {
  if (!list.start || !list.end) return true;
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = list.start.split(':').map(Number);
  const [eh, em] = list.end.split(':').map(Number);
  const startM = sh * 60 + sm;
  const endM = eh * 60 + em;
  if (startM <= endM) {
    return minutes >= startM && minutes <= endM;
  } else {
    return minutes >= startM || minutes <= endM;
  }
}

function listActive(list) {
  if (list.pomodoro) return Date.now() < list.pomodoro.until;
  return inSchedule(list);
}

function patternMatches(pattern, url) {
  try {
    const u = new URL(url);
    if (pattern.includes('://')) {
      return url.startsWith(pattern);
    }
    const idx = pattern.indexOf('/');
    const domain = idx === -1 ? pattern : pattern.slice(0, idx);
    const path = idx === -1 ? '' : pattern.slice(idx);
    if (u.hostname === domain || u.hostname.endsWith('.' + domain)) {
      return u.pathname.startsWith(path);
    }
  } catch (e) {
    // ignore malformed URLs
  }
  return false;
}

function matches(list, url) {
  return list.patterns.some(p => patternMatches(p, url));
}

function isBlocked(url) {
  const activeAllows = lists.filter(l => l.type === 'allow' && listActive(l));
  if (activeAllows.length) {
    return !activeAllows.some(l => matches(l, url));
  }
  return lists.some(
    l => l.type === 'block' && listActive(l) && matches(l, url)
  );
}

async function loadData() {
  const data = await browser.storage.local.get({lists: null, blocked: [], timeSpent: {}});
  if (!data.lists) {
    data.lists = [{
      id: Date.now(),
      name: 'Default Block',
      type: 'block',
      patterns: data.blocked.map(e => e.pattern),
      start: null,
      end: null,
      pomodoro: null
    }];
    await browser.storage.local.set({lists: data.lists, blocked: []});
  }
  lists = data.lists;
  timeSpent = data.timeSpent;
}

loadData();

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.lists) lists = changes.lists.newValue;
    if (changes.timeSpent) timeSpent = changes.timeSpent.newValue;
  }
});

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
  const data = await browser.storage.local.get({lists: []});
  if (data.lists.length === 0) {
    data.lists.push({id: Date.now(), name: 'Default Block', type: 'block', patterns: [], start: null, end: null, pomodoro: null});
  }
  const list = data.lists[0];
  if (!list.patterns.includes(url)) {
    list.patterns.push(url);
  }
  await browser.storage.local.set({lists: data.lists});
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
