'use strict';

// Storage keys
const DEFAULT_STATE = {
  mode: 'block', // 'block' or 'allow'
  blockPatterns: ['reddit.com'], // list of URL patterns when in block mode
  allowPatterns: [], // list of URL patterns when in allow mode
  exceptionPatterns: ['reddit.com/r/*/comments/'], // list of exception patterns within blocked URLs
  sessions: [ // default focus session
    {
      id: 'default-session',
      days: [1, 2, 3, 4, 5],
      start: '08:00',
      end: '17:00',
      break: 15,
      breaksAllowed: 3
    }
  ],
  immediate: false, // manual immediate block
  breakUntil: 0,
  breakDuration: 15,
  resumeUrl: '',
  sessionBreakUsage: {}
};

let state = Object.assign({}, DEFAULT_STATE);
let lastFocus = false;


async function restoreTabs() {
  const blockedPage = browser.runtime.getURL('pages/blocked/blocked.html');
  const tabs = await browser.tabs.query({});
  for (const tab of tabs) {
    if (tab.url && tab.url.startsWith(blockedPage)) {
      const query = tab.url.split('?')[1] || '';
      const url = new URLSearchParams(query).get('url');
      if (url) {
        browser.tabs.update(tab.id, { url });
      }
    }
  }
}


async function enforceBlocking() {
  const tabs = await browser.tabs.query({});
  for (const tab of tabs) {
    if (tab.url && isBlocked(tab.url)) {
      const blockedUrl = browser.runtime.getURL('pages/blocked/blocked.html') +
        '?url=' + encodeURIComponent(tab.url);
      browser.tabs.update(tab.id, { url: blockedUrl });
    }
  }
}

async function loadState() {
  const data = await browser.storage.local.get([...Object.keys(DEFAULT_STATE), 'patterns']);
  state = Object.assign({}, DEFAULT_STATE, data);
  // migrate old single pattern list if present
  if (Array.isArray(data.patterns)) {
    if (!data.blockPatterns && state.mode === 'block') {
      state.blockPatterns = data.patterns;
    } else if (!data.allowPatterns && state.mode === 'allow') {
      state.allowPatterns = data.patterns;
    }
  }
  const dirty = ensureSessionConsistency();
  lastFocus = focusActive();

  if (lastFocus) {
    enforceBlocking();
  } else {
    restoreTabs();
  }

  if (dirty) {
    await saveState();
  }

}

function saveState() {
  return browser.storage.local.set(state);
}

function escapeRegex(str) {
  return str.replace(/[|\\{}()\[\]^$+*?.]/g, '\$&');
}

function wildcardRegex(pattern, end = false, flags = '') {
  const escaped = pattern
    .split('*')
    .map(escapeRegex)
    .join('.*');
  return new RegExp('^' + escaped + (end ? '$' : ''), flags);
}

function patternMatches(pattern, url) {
  try {
    const u = new URL(url);
    if (pattern.includes('://')) {
      return wildcardRegex(pattern).test(url);
    }
    const idx = pattern.indexOf('/');
    const domain = idx === -1 ? pattern : pattern.slice(0, idx);
    const path = idx === -1 ? '' : pattern.slice(idx);

    let domainMatched = false;
    if (domain.includes('*')) {
      domainMatched = wildcardRegex(domain, true, 'i').test(u.hostname);
    } else {
      domainMatched = u.hostname === domain || u.hostname.endsWith('.' + domain);
    }
    if (!domainMatched) return false;

    if (!path) return true;
    return wildcardRegex(path).test(u.pathname);
  } catch (e) {
    // ignore
  }
  return false;
}

function withinSession(session) {
  const now = new Date();
  if (!session.days.includes(now.getDay())) return false;
  const [sh, sm] = session.start.split(':').map(Number);
  const [eh, em] = session.end.split(':').map(Number);
  const startM = sh * 60 + sm;
  const endM = eh * 60 + em;
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (startM <= endM) return minutes >= startM && minutes < endM;
  return minutes >= startM || minutes < endM;
}

function checkBreaks() {
  const now = Date.now();
  if (state.breakUntil && now >= state.breakUntil) {
    state.breakUntil = 0;
    state.resumeUrl = '';
    saveState();
    enforceBlocking();
    checkFocusChange();
  }
  if (state.immediate || state.breakUntil) return;
  for (const ses of state.sessions) {
    const [eh, em] = ses.end.split(':').map(Number);
    const end = new Date();
    end.setHours(eh, em, 0, 0);
    if (withinSession(ses)) return;
    const diff = Date.now() - end.getTime();
    if (diff >= 0 && diff < 60000) {
      if (ses.break > 0) {
        state.breakUntil = Date.now() + ses.break * 60000;
        saveState();
      }
    }
  }
  checkFocusChange();
}

function focusActive() {
  if (state.breakUntil && Date.now() < state.breakUntil) return false;
  if (state.immediate) return true;
  return !!getActiveSession();
}

function checkFocusChange() {
  const active = focusActive();
  if (active && !lastFocus) {
    enforceBlocking();

  } else if (!active && lastFocus) {
    restoreTabs();

  }
  lastFocus = active;
}

function isBlocked(url) {
  try {
    const scheme = new URL(url).protocol;
    if (scheme !== 'http:' && scheme !== 'https:') return false;
  } catch (e) {
    return false;
  }
  if (!focusActive()) return false;
  if (state.mode === 'block') {
    const matched = state.blockPatterns.some(p => patternMatches(p, url));
    if (!matched) return false;
    const exceptionMatched = state.exceptionPatterns.some(p => patternMatches(p, url));
    return !exceptionMatched;
  }
  const matched = state.allowPatterns.some(p => patternMatches(p, url));
  return !matched;
}

browser.webNavigation.onCommitted.addListener(details => {
  // Only evaluate the top-level frame to avoid blocking embedded resources
  if (details.frameId === 0 && isBlocked(details.url)) {
    const blockedUrl = browser.runtime.getURL('pages/blocked/blocked.html') + '?url=' + encodeURIComponent(details.url);
    browser.tabs.update(details.tabId, {url: blockedUrl});
  }
});

// Some sites update the URL without a full navigation (e.g. via the history
// API). Listen for tab updates so we catch those changes as well as normal
// loads.
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && isBlocked(changeInfo.url)) {
    const blockedUrl = browser.runtime.getURL('pages/blocked/blocked.html') + '?url=' + encodeURIComponent(changeInfo.url);
    browser.tabs.update(tabId, { url: blockedUrl });
  }
});

browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'unblockUrl' && msg.url) {
    if (state.mode === 'allow') {
      if (!state.allowPatterns.includes(msg.url)) state.allowPatterns.push(msg.url);
    } else {
      const idx = state.blockPatterns.indexOf(msg.url);
      if (idx !== -1) state.blockPatterns.splice(idx, 1);
    }
    return saveState();
  }
  if (msg.type === 'start-break') {
    const dur = (msg.duration || state.breakDuration) * 60000;
    if (!state.breakUntil || Date.now() >= state.breakUntil) {
      const activeSession = getActiveSession();
      if (activeSession) {
        const allowed = typeof activeSession.breaksAllowed === 'number'
          ? Math.max(0, Math.min(3, activeSession.breaksAllowed))
          : 0;
        if (allowed === 0) {
          return Promise.reject({ code: 'break-limit' });
        }
        const usage = getSessionUsage(activeSession);
        if (usage.used >= allowed) {
          return Promise.reject({ code: 'break-limit' });
        }
        usage.used += 1;
      }
      state.breakUntil = Date.now() + dur;
      state.immediate = false;
      if (msg.url) state.resumeUrl = msg.url;
      saveState();
    } else if (msg.url) {
      state.resumeUrl = msg.url;
      saveState();
    }
    checkFocusChange();
    return Promise.resolve(state.breakUntil);
  }
  if (msg.type === 'stop-break') {
    state.breakUntil = 0;
    state.resumeUrl = '';
    const p = saveState();
    enforceBlocking();
    checkFocusChange();
    return p;
  }
  if (msg.type === 'unblock-now') {
    state.immediate = false;
    const p = saveState();
    checkFocusChange();
    return p;
  } else if (msg.type === 'block-now') {
    state.immediate = true;
    state.breakUntil = 0;
    const p = saveState();
    enforceBlocking();
    checkFocusChange();
    return p;
  }
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    for (const key of Object.keys(changes)) {
      state[key] = changes[key].newValue;
      if (key === 'sessions') {
        if (ensureSessionConsistency()) {
          saveState();
        }
      }
    }
    restoreTabs();
    enforceBlocking();
    checkFocusChange();
  }
});

loadState();
setInterval(checkBreaks, 60000);

function generateSessionId() {
  return 'ses-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function ensureSessionDefaults(session) {
  let modified = false;
  if (!session.id) {
    session.id = generateSessionId();
    modified = true;
  }
  if (typeof session.breaksAllowed !== 'number') {
    session.breaksAllowed = 0;
    modified = true;
  } else {
    const normalized = Math.max(0, Math.min(3, Math.round(session.breaksAllowed)));
    if (normalized !== session.breaksAllowed) {
      session.breaksAllowed = normalized;
      modified = true;
    }
  }
  return modified;
}

function ensureSessionConsistency() {
  if (!state.sessions) state.sessions = [];
  if (!state.sessionBreakUsage || typeof state.sessionBreakUsage !== 'object') {
    state.sessionBreakUsage = {};
  }
  let changed = false;
  state.sessions.forEach((session) => {
    if (ensureSessionDefaults(session)) changed = true;
  });
  const validIds = new Set(state.sessions.map(s => s.id));
  for (const id of Object.keys(state.sessionBreakUsage)) {
    if (!validIds.has(id)) {
      delete state.sessionBreakUsage[id];
      changed = true;
    }
  }
  return changed;
}

function getActiveSession() {
  if (state.breakUntil && Date.now() < state.breakUntil) return null;
  return state.sessions.find(withinSession) || null;
}

function getSessionUsage(session) {
  const key = dateKey();
  const existing = state.sessionBreakUsage[session.id];
  if (!existing || existing.key !== key) {
    state.sessionBreakUsage[session.id] = { key, used: 0 };
  }
  return state.sessionBreakUsage[session.id];
}

function dateKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
