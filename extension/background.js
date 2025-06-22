let lists = [];
let timeSpent = {};
let currentDomain = null;
let activeListId = null;

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
  if (list.manual === 'block') return true;
  if (list.manual === 'unblock') return false;
  if (list.manual === 'block') return true;
  if (list.manual === 'unblock') return false;
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
  return list.patterns.some(p => patternMatches(p, url));
}

function isBlocked(url) {
  try {
    const scheme = new URL(url).protocol;
    if (scheme !== 'http:' && scheme !== 'https:') {
      return false;
    }
  } catch (e) {
    return false;
  }
  const list = lists.find(l => l.id === activeListId);
  if (!list || !listActive(list)) return false;
  if (list.type === 'allow') {
    return !matches(list, url);
  }
  return matches(list, url);
}

async function loadData() {
  const data = await browser.storage.local.get({lists: null, blocked: [], timeSpent: {}, activeListId: null});
  if (!data.lists) {
    data.lists = [{
      id: Date.now(),
      name: 'Default Block',
      type: 'block',
      patterns: data.blocked.map(e => e.pattern),
      start: null,
      end: null,
      pomodoro: null,
      manual: null
      pomodoro: null,
      manual: null
    }];
    await browser.storage.local.set({lists: data.lists, blocked: []});
  }
  lists = data.lists.map(l => Object.assign({manual: null}, l));
  lists = data.lists.map(l => Object.assign({manual: null}, l));
  timeSpent = data.timeSpent;
  activeListId = data.activeListId !== null ? data.activeListId : lists[0].id;
}

loadData();

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.lists) lists = changes.lists.newValue;
    if (changes.timeSpent) timeSpent = changes.timeSpent.newValue;
    if (changes.activeListId) activeListId = changes.activeListId.newValue;
  }
});

browser.webNavigation.onCommitted.addListener((details) => {
  if (isBlocked(details.url)) {
    const blockPage = browser.runtime.getURL('blocked.html') +
      '?url=' + encodeURIComponent(details.url);
    browser.tabs.update(details.tabId, {url: blockPage});
  }
});

async function handleUnblock(url) {
  const list = lists.find(l => l.id === activeListId);
  if (!list) return;
  if (list.type === 'allow') {
    if (!list.patterns.includes(url)) list.patterns.push(url);
  } else {
    const idx = list.patterns.indexOf(url);
    if (idx !== -1) list.patterns.splice(idx, 1);
  }
  await browser.storage.local.set({lists});
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'unblockUrl' && msg.url) {
    handleUnblock(msg.url);
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
  const data = await browser.storage.local.get({lists: [], activeListId: null});
  if (data.lists.length === 0) {
    data.lists.push({id: Date.now(), name: 'Default Block', type: 'block', patterns: [], start: null, end: null, pomodoro: null, manual: null});
    data.activeListId = data.lists[0].id;
  }
  const list = data.lists.find(l => l.id === (data.activeListId || data.lists[0].id));
  if (!list.patterns.includes(url)) {
    list.patterns.push(url);
  }
  await browser.storage.local.set({lists: data.lists, activeListId: data.activeListId});
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
