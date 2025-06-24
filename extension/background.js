'use strict';

// Storage keys
const DEFAULT_STATE = {
  mode: 'block', // 'block' or 'allow'
  patterns: [], // list of URL patterns
  sessions: [], // [{days:[0-6], start:'HH:MM', end:'HH:MM', break:5}]
  immediate: false, // manual immediate block
  breakUntil: 0,
  breakDuration: 5,
  resumeUrl: ''
};

let state = Object.assign({}, DEFAULT_STATE);

async function loadState() {
  const data = await browser.storage.local.get(Object.keys(DEFAULT_STATE));
  state = Object.assign({}, DEFAULT_STATE, data);
}

function saveState() {
  return browser.storage.local.set(state);
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
}

function focusActive() {
  if (state.breakUntil && Date.now() < state.breakUntil) return false;
  if (state.immediate) return true;
  return state.sessions.some(withinSession);
}

function isBlocked(url) {
  try {
    const scheme = new URL(url).protocol;
    if (scheme !== 'http:' && scheme !== 'https:') return false;
  } catch (e) {
    return false;
  }
  if (!focusActive()) return false;
  const matched = state.patterns.some(p => patternMatches(p, url));
  if (state.mode === 'block') return matched;
  return !matched;
}

browser.webNavigation.onCommitted.addListener(details => {
  if (isBlocked(details.url)) {
    const blockedUrl = browser.runtime.getURL('blocked.html') + '?url=' + encodeURIComponent(details.url);
    browser.tabs.update(details.tabId, {url: blockedUrl});
  }
});

browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'unblockUrl' && msg.url) {
    if (state.mode === 'allow') {
      if (!state.patterns.includes(msg.url)) state.patterns.push(msg.url);
    } else {
      const idx = state.patterns.indexOf(msg.url);
      if (idx !== -1) state.patterns.splice(idx, 1);
    }
    return saveState();
  }
  if (msg.type === 'start-break') {
    const dur = (msg.duration || state.breakDuration) * 60000;
    if (!state.breakUntil || Date.now() >= state.breakUntil) {
      state.breakUntil = Date.now() + dur;
      state.immediate = false;
      if (msg.url) state.resumeUrl = msg.url;
      saveState();
    } else if (msg.url) {
      state.resumeUrl = msg.url;
      saveState();
    }
    return Promise.resolve(state.breakUntil);
  }
  if (msg.type === 'stop-break') {
    state.breakUntil = 0;
    state.resumeUrl = '';
    return saveState();
  }
  if (msg.type === 'unblock-now') {
    state.immediate = false;
    return saveState();
  } else if (msg.type === 'block-now') {
    state.immediate = true;
    state.breakUntil = 0;
    return saveState();
  }
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    for (const key of Object.keys(changes)) {
      state[key] = changes[key].newValue;
    }
  }
});

loadState();
setInterval(checkBreaks, 60000);
