'use strict';

const stateEl = document.getElementById('state');
const toggleBtn = document.getElementById('toggle');
const optionsLink = document.getElementById('openOptions');
const durInput = document.getElementById('popupDuration');
const startBtn = document.getElementById('popupStart');
const stopBtn = document.getElementById('popupStop');
const exceptionBtn = document.getElementById('addException');
const exceptionMsg = document.getElementById('exceptionMsg');
const breakMsg = document.getElementById('popupBreakMsg');

let state = {
  immediate: false,
  breakUntil: 0,
  mode: 'block',
  exceptionPatterns: ['reddit.com/r/*/comments/'],
  sessions: [
    {
      id: 'default-session',
      days: [1, 2, 3, 4, 5],
      start: '08:00',
      end: '17:00',
      break: 15,
      breaksAllowed: 3
    }
  ]
};

let currentUrl = '';

function extractTargetUrl(tabUrl) {
  if (!tabUrl) return '';
  try {
    const blockedPage = browser.runtime.getURL('pages/blocked/blocked.html');
    if (tabUrl.startsWith(blockedPage)) {
      const query = tabUrl.split('?')[1] || '';
      const target = new URLSearchParams(query).get('url');
      return target ? decodeURIComponent(target) : '';
    }
  } catch (e) {
    // ignore parsing errors
  }
  return tabUrl;
}

async function load() {
  const data = await browser.storage.local.get([
    'immediate',
    'breakUntil',
    'breakDuration',
    'mode',
    'exceptionPatterns',
    'sessions'
  ]);
  Object.assign(state, data);
  durInput.value = data.breakDuration || 15;
  const tabs = await browser.tabs.query({active:true, currentWindow:true});
  currentUrl = tabs[0] ? extractTargetUrl(tabs[0].url) : '';
  update();
  updateExceptionButton();
}

function isOnBreak() {
  return state.breakUntil && Date.now() < state.breakUntil;
}

function withinSession(session, referenceDate = new Date()) {
  if (!session || !Array.isArray(session.days)) return false;
  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  if (!session.days.includes(now.getDay())) return false;
  if (typeof session.start !== 'string' || typeof session.end !== 'string') return false;
  const [sh, sm] = session.start.split(':').map(Number);
  const [eh, em] = session.end.split(':').map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return false;
  const startM = sh * 60 + sm;
  const endM = eh * 60 + em;
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (startM <= endM) return minutes >= startM && minutes < endM;
  return minutes >= startM || minutes < endM;
}

function scheduledSessionActive() {
  if (!Array.isArray(state.sessions)) return false;
  return state.sessions.some(s => withinSession(s));
}

function focusActive() {
  if (isOnBreak()) return false;
  if (state.immediate) return true;
  return scheduledSessionActive();
}

function update() {
  const onBreak = isOnBreak();
  const scheduled = scheduledSessionActive();
  const active = focusActive();

  if (onBreak) {
    const rem = Math.ceil((state.breakUntil - Date.now()) / 1000);
    stateEl.textContent = 'Break: ' + Math.floor(rem/60) + 'm ' + (rem%60) + 's';
    toggleBtn.textContent = 'Block Now';
    toggleBtn.disabled = true;
    startBtn.disabled = true;
    durInput.disabled = true;
    stopBtn.style.display = 'inline-block';
  } else if (active) {
    stateEl.textContent = scheduled && !state.immediate ? 'Blocking (Scheduled)' : 'Blocking';
    toggleBtn.textContent = state.immediate ? 'Unblock' : 'Block Now';
    toggleBtn.disabled = false;
    startBtn.disabled = false;
    durInput.disabled = false;
    stopBtn.style.display = 'none';
  } else {
    stateEl.textContent = 'Idle';
    toggleBtn.textContent = 'Block Now';
    toggleBtn.disabled = false;
    startBtn.disabled = false;
    durInput.disabled = false;
    stopBtn.style.display = 'none';
  }
}

toggleBtn.addEventListener('click', () => {
  if (state.breakUntil && Date.now() < state.breakUntil) return;
  if (state.immediate) {
    browser.runtime.sendMessage({type: 'unblock-now'});
    state.immediate = false;
  } else {
    browser.runtime.sendMessage({type: 'block-now'});
    state.immediate = true;
  }
  update();
});

async function startBreak(duration) {
  setBreakMsg('');
  const dur = duration || parseInt(durInput.value,10) || 5;
  let until;
  try {
    until = await browser.runtime.sendMessage({type:'start-break', duration:dur});
  } catch (err) {
    if (err && (err.code === 'break-limit' || err.message === 'break-limit')) {
      setBreakMsg('No breaks remaining for this focus session.');
    } else {
      setBreakMsg('Unable to start break. Please try again.');
    }
    return;
  }
  state.breakUntil = until;
  update();
}

async function stopBreak() {
  await browser.runtime.sendMessage({type:'stop-break'});
  state.breakUntil = 0;
  update();
  setBreakMsg('');
}

startBtn.addEventListener('click', () => startBreak());
stopBtn.addEventListener('click', stopBreak);

optionsLink.addEventListener('click', (e) => {
  e.preventDefault();
  browser.runtime.openOptionsPage();
});

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch (e) {
    return url;
  }
}

function updateExceptionButton() {
  if (!exceptionBtn) return;
  if (state.mode !== 'block' || !currentUrl) {
    exceptionBtn.style.display = 'none';
    return;
  }
  exceptionBtn.style.display = 'block';
  const pattern = normalizeUrl(currentUrl);
  const exists = state.exceptionPatterns.includes(pattern);
  if (exists) {
    exceptionBtn.textContent = 'Already in Exception List';
    exceptionBtn.disabled = true;
  } else {
    exceptionBtn.textContent = 'Add to Exception List';
    exceptionBtn.disabled = false;
  }
}

function setBreakMsg(message) {
  if (!breakMsg) return;
  breakMsg.textContent = message || '';
}

exceptionBtn.addEventListener('click', async () => {
  if (!currentUrl) return;
  const pattern = normalizeUrl(currentUrl);
  const data = await browser.storage.local.get(['exceptionPatterns']);
  const list = data.exceptionPatterns || [];
  if (!list.includes(pattern)) {
    list.push(pattern);
    await browser.storage.local.set({exceptionPatterns: list});
    exceptionMsg.textContent = 'URL added to exceptions';
    setTimeout(() => { exceptionMsg.textContent = ''; }, 2000);
    state.exceptionPatterns = list;
    updateExceptionButton();
    const tabs = await browser.tabs.query({active:true, currentWindow:true});
    if (tabs[0]) browser.tabs.update(tabs[0].id, {url: currentUrl});
  }
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.immediate) state.immediate = changes.immediate.newValue;
    if (changes.breakUntil) state.breakUntil = changes.breakUntil.newValue;
    if (changes.breakDuration) durInput.value = changes.breakDuration.newValue;
    if (changes.mode) state.mode = changes.mode.newValue;
    if (changes.exceptionPatterns) state.exceptionPatterns = changes.exceptionPatterns.newValue;
    if (changes.sessions) state.sessions = changes.sessions.newValue;
    update();
    updateExceptionButton();
  }
});

load();
setInterval(update, 1000);
