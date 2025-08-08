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

let breakUntil = 0;
let breakDuration = 0; // ms
let intervalId = null;
let delayInterval = null;
let pendingDuration = 0;
let mode = 'block';
let exceptionPatterns = ['reddit.com/r/*/comments/'];

msgEl.textContent = `The following URL is blocked: ${url}`;

function updateTimer() {
  const now = Date.now();
  const rem = breakUntil - now;
  if (rem <= 0) {
    clearInterval(intervalId);
    intervalId = null;
    timerEl.textContent = '';
    progress.style.width = '0%';
    btn.disabled = false;
    durInput.disabled = false;
    quickBtns.forEach(b => b.disabled = false);
    stopBtn.style.display = 'none';
    breakUntil = 0;
    // When the break ends, controls reset but no automatic redirect occurs
    return;
  }
  const sec = Math.ceil(rem / 1000);
  timerEl.textContent = `Break ends in ${Math.floor(sec / 60)}m ${sec % 60}s`;
  if (breakDuration) {
    const used = breakDuration - rem;
    const pct = Math.min(100, Math.max(0, (used / breakDuration) * 100));
    progress.style.width = pct + '%';
  }
}


async function startBreak(duration) {
  const dur = duration || parseInt(durInput.value, 10) || 5;
  const until = await browser.runtime.sendMessage({ type: 'start-break', duration: dur, url });
  breakDuration = dur * 60000;
  breakUntil = until;
  btn.disabled = true;
  durInput.disabled = true;
  quickBtns.forEach(b => b.disabled = true);
  stopBtn.style.display = 'inline-block';
  updateTimer();
  if (!intervalId) intervalId = setInterval(updateTimer, 1000);
  location.href = url;
}

async function stopBreak() {
  await browser.runtime.sendMessage({ type: 'stop-break' });
  breakUntil = 0;
  updateTimer();
}

function hideDelay() {
  if (delayInterval) {
    clearInterval(delayInterval);
    delayInterval = null;
  }
  countdown.style.display = 'none';
}

function showDelay(duration) {
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

(async function init() {
  const data = await browser.storage.local.get(['breakUntil', 'breakDuration','resumeUrl','mode','exceptionPatterns']);
  breakUntil = data.breakUntil || 0;
  breakDuration = (data.breakDuration || 5) * 60000;
  durInput.value = data.breakDuration || 5;
  mode = data.mode || 'block';
  exceptionPatterns = data.exceptionPatterns || [];
  updateExceptionButton();
  if (breakUntil > Date.now()) {
    btn.disabled = true;
    durInput.disabled = true;
    quickBtns.forEach(b => b.disabled = true);
    stopBtn.style.display = 'inline-block';
    updateTimer();
    intervalId = setInterval(updateTimer, 1000);
  }
})();

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.mode) mode = changes.mode.newValue;
    if (changes.exceptionPatterns) exceptionPatterns = changes.exceptionPatterns.newValue;
    updateExceptionButton();
  }
});
