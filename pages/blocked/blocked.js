'use strict';

const params = new URLSearchParams(location.search);
const url = params.get('url') || '';
const msgEl = document.getElementById('msg');
const btn = document.getElementById('breakBtn');
const stopBtn = document.getElementById('stopBreakBtn');
const timerEl = document.getElementById('breakTimer');
const progress = document.getElementById('progressBar');
const durInput = document.getElementById('durationInput');
const quickBtns = document.querySelectorAll('.quickBreak');
const countdown = document.getElementById('countdownOverlay');
const delayTimer = document.getElementById('delayTimer');
const cancelDelay = document.getElementById('cancelDelay');
const continueDelay = document.getElementById('continueDelay');
const addExcBtn = document.getElementById('addExceptionBtn');
const excMsg = document.getElementById('blockedExceptionMsg');
const breakError = document.getElementById('breakError');
const bodyEl = document.body;

let breakUntil = 0;
let breakDuration = 0; // ms
let intervalId = null;
let delayInterval = null;
let pendingDuration = 0;
let mode = 'block';
let exceptionPatterns = ['reddit.com/r/*/comments/'];
let sessions = [];
let sessionBreakUsage = {};
let noBreaksRemaining = false;

msgEl.textContent = `The following URL is blocked: ${url}`;

function updateTimer() {
  const now = Date.now();
  const rem = breakUntil - now;
  if (rem <= 0) {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    timerEl.textContent = '';
    progress.style.width = '0%';
    breakUntil = 0;
    // When the break ends, controls reset but no automatic redirect occurs
    applyControls();
    return;
  }
  const sec = Math.ceil(rem / 1000);
  timerEl.textContent = `Break ends in ${Math.floor(sec / 60)}m ${sec % 60}s`;
  if (breakDuration) {
    const used = breakDuration - rem;
    const pct = Math.min(100, Math.max(0, (used / breakDuration) * 100));
    progress.style.width = pct + '%';
  }
  applyControls();
}


async function startBreak(duration) {
  setBreakError('');
  const dur = duration || parseInt(durInput.value, 10) || 5;
  let until;
  try {
    until = await browser.runtime.sendMessage({ type: 'start-break', duration: dur, url });
  } catch (err) {
    if (err && (err.code === 'break-limit' || err.message === 'break-limit')) {
      setBreakError('No breaks remaining for this focus session.');
      markNoBreaks(true);
    } else {
      setBreakError('Unable to start break. Please try again.');
    }
    return;
  }
  breakDuration = dur * 60000;
  breakUntil = until;
  applyControls();
  updateTimer();
  if (!intervalId) intervalId = setInterval(updateTimer, 1000);
  location.href = url;
}

async function stopBreak() {
  await browser.runtime.sendMessage({ type: 'stop-break' });
  breakUntil = 0;
  updateTimer();
  setBreakError('');
}

function hideDelay() {
  if (delayInterval) {
    clearInterval(delayInterval);
    delayInterval = null;
  }
  countdown.style.display = 'none';
}

function showDelay(duration) {
  setBreakError('');
  hideDelay();
  pendingDuration = duration || parseInt(durInput.value, 10) || 5;
  let remaining = 15;
  delayTimer.textContent = `${remaining} seconds remaining`;
  countdown.style.display = 'block';
  continueDelay.disabled = true;
  delayInterval = setInterval(() => {
    remaining -= 1;
    if (remaining > 0) {
      delayTimer.textContent = `${remaining} seconds remaining`;
    } else {
      clearInterval(delayInterval);
      delayInterval = null;
      delayTimer.textContent = 'Ready';
      continueDelay.disabled = false;
    }
  }, 1000);
}

cancelDelay.addEventListener('click', () => hideDelay());
continueDelay.addEventListener('click', () => {
  hideDelay();
  startBreak(pendingDuration);
});

btn.addEventListener('click', () => showDelay());
quickBtns.forEach(b => {
  b.addEventListener('click', () => showDelay(parseInt(b.dataset.duration,10)));
});
stopBtn.addEventListener('click', stopBreak);
addExcBtn.addEventListener('click', async () => {
  const pattern = normalizeUrl(url);
  const data = await browser.storage.local.get(['exceptionPatterns']);
  const list = data.exceptionPatterns || [];
  if (!list.includes(pattern)) {
    list.push(pattern);
    await browser.storage.local.set({exceptionPatterns: list});
    excMsg.textContent = 'URL added to exceptions';
    setTimeout(() => { excMsg.textContent = ''; }, 2000);
    exceptionPatterns = list;
    updateExceptionButton();
    setTimeout(() => { location.href = url; }, 500);
  }
});

function normalizeUrl(u) {
  try {
    const x = new URL(u);
    return x.origin + x.pathname;
  } catch (e) {
    return u;
  }
}

function updateExceptionButton() {
  if (!addExcBtn) return;
  if (noBreaksRemaining) {
    addExcBtn.style.display = 'none';
    return;
  }
  if (mode !== 'block' || !url) {
    addExcBtn.style.display = 'none';
    return;
  }
  addExcBtn.style.display = 'inline-block';
  const pattern = normalizeUrl(url);
  const exists = exceptionPatterns.includes(pattern);
  if (exists) {
    addExcBtn.textContent = 'Already in Exception List';
    addExcBtn.disabled = true;
  } else {
    addExcBtn.textContent = 'Add to Exception List';
    addExcBtn.disabled = false;
  }
}

function setBreakError(message) {
  if (!breakError) return;
  breakError.textContent = message || '';
}

function isOnBreak() {
  return typeof breakUntil === 'number' && breakUntil > Date.now();
}

function applyControls() {
  const onBreak = isOnBreak();
  const limitActive = noBreaksRemaining && !onBreak;

  if (onBreak) {
    btn.disabled = true;
    durInput.disabled = true;
    quickBtns.forEach(b => b.disabled = true);
    stopBtn.style.display = 'inline-block';
  } else {
    btn.disabled = limitActive;
    durInput.disabled = limitActive;
    quickBtns.forEach(b => b.disabled = limitActive);
    stopBtn.style.display = 'none';
  }
}

function markNoBreaks(flag) {
  noBreaksRemaining = !!flag;
  if (bodyEl) bodyEl.classList.toggle('noBreaks', noBreaksRemaining);
  applyControls();
  updateExceptionButton();
}

function updateBreakAvailability() {
  const limitReached = computeBreakLimit();
  markNoBreaks(limitReached);
}

function computeBreakLimit() {
  if (!Array.isArray(sessions) || sessions.length === 0) return false;
  const active = getActiveSession();
  if (!active) return false;
  const allowed = typeof active.breaksAllowed === 'number'
    ? Math.max(0, Math.min(3, Math.round(active.breaksAllowed)))
    : 0;
  if (allowed === 0) return true;
  const usage = sessionBreakUsage && sessionBreakUsage[active.id];
  const key = dateKey();
  if (!usage || usage.key !== key) return false;
  return usage.used >= allowed;
}

function getActiveSession(referenceDate = new Date()) {
  if (!Array.isArray(sessions)) return null;
  return sessions.find(s => withinSession(s, referenceDate)) || null;
}

function withinSession(session, referenceDate = new Date()) {
  if (!session || !Array.isArray(session.days)) return false;
  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  if (!session.days.includes(now.getDay())) return false;
  if (typeof session.start !== 'string' || typeof session.end !== 'string') return false;
  const [sh, sm] = session.start.split(':').map(Number);
  const [eh, em] = session.end.split(':').map(Number);
  if (Number.isNaN(sh) || Number.isNaN(sm) || Number.isNaN(eh) || Number.isNaN(em)) return false;
  const startM = sh * 60 + sm;
  const endM = eh * 60 + em;
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (startM <= endM) return minutes >= startM && minutes < endM;
  return minutes >= startM || minutes < endM;
}

function dateKey(referenceDate = new Date()) {
  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

(async function init() {
  const data = await browser.storage.local.get([
    'breakUntil',
    'breakDuration',
    'resumeUrl',
    'mode',
    'exceptionPatterns',
    'sessions',
    'sessionBreakUsage'
  ]);
  breakUntil = data.breakUntil || 0;
  breakDuration = (data.breakDuration || 5) * 60000;
  durInput.value = data.breakDuration || 5;
  mode = data.mode || 'block';
  exceptionPatterns = data.exceptionPatterns || [];
  sessions = Array.isArray(data.sessions) ? data.sessions : [];
  sessionBreakUsage = data.sessionBreakUsage || {};
  updateBreakAvailability();
  updateExceptionButton();
  if (isOnBreak()) {
    updateTimer();
    intervalId = setInterval(updateTimer, 1000);
  } else {
    applyControls();
  }
})();

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.mode) mode = changes.mode.newValue;
    if (changes.exceptionPatterns) exceptionPatterns = changes.exceptionPatterns.newValue;
    if (changes.sessions) sessions = changes.sessions.newValue || [];
    if (changes.sessionBreakUsage) sessionBreakUsage = changes.sessionBreakUsage.newValue || {};
    if (changes.breakUntil) {
      breakUntil = changes.breakUntil.newValue || 0;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      if (isOnBreak()) {
        updateTimer();
        intervalId = setInterval(updateTimer, 1000);
      } else {
        updateTimer();
      }
    }
    updateBreakAvailability();
    updateExceptionButton();
  }
});
