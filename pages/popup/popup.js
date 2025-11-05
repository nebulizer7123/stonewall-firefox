'use strict';

const stateEl = document.getElementById('state');
const toggleBtn = document.getElementById('toggle');
const optionsLink = document.getElementById('openOptions');
const durInput = document.getElementById('popupDuration');
const startBtn = document.getElementById('popupStart');
const stopBtn = document.getElementById('popupStop');
const quickBtns = document.querySelectorAll('.popupQuick');
const exceptionBtn = document.getElementById('addException');
const exceptionMsg = document.getElementById('exceptionMsg');

let state = {
  immediate: false,
  breakUntil: 0,
  mode: 'block',
  exceptionPatterns: ['reddit.com/r/*/comments/']
};

let currentUrl = '';

async function load() {
  const data = await browser.storage.local.get(['immediate','breakUntil','breakDuration','mode','exceptionPatterns']);
  Object.assign(state, data);
  durInput.value = data.breakDuration || 5;
  const tabs = await browser.tabs.query({active:true, currentWindow:true});
  currentUrl = tabs[0] ? tabs[0].url : '';
  update();
  updateExceptionButton();
}

function update() {
  if (state.breakUntil && Date.now() < state.breakUntil) {
    const rem = Math.ceil((state.breakUntil - Date.now()) / 1000);
    stateEl.textContent = 'Break: ' + Math.floor(rem/60) + 'm ' + (rem%60) + 's';
    toggleBtn.textContent = 'Block Now';
    toggleBtn.disabled = true;
    startBtn.disabled = true;
    durInput.disabled = true;
    quickBtns.forEach(b => b.disabled = true);
    stopBtn.style.display = 'inline-block';
  } else if (state.immediate) {
    stateEl.textContent = 'Blocking';
    toggleBtn.textContent = 'Unblock';
    toggleBtn.disabled = false;
    startBtn.disabled = false;
    durInput.disabled = false;
    quickBtns.forEach(b => b.disabled = false);
    stopBtn.style.display = 'none';
  } else {
    stateEl.textContent = 'Idle';
    toggleBtn.textContent = 'Block Now';
    toggleBtn.disabled = false;
    startBtn.disabled = false;
    durInput.disabled = false;
    quickBtns.forEach(b => b.disabled = false);
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
  const dur = duration || parseInt(durInput.value,10) || 5;
  const until = await browser.runtime.sendMessage({type:'start-break', duration:dur});
  state.breakUntil = until;
  update();
}

async function stopBreak() {
  await browser.runtime.sendMessage({type:'stop-break'});
  state.breakUntil = 0;
  update();
}

startBtn.addEventListener('click', () => startBreak());
quickBtns.forEach(b => b.addEventListener('click', () => startBreak(parseInt(b.dataset.duration,10))));
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
    update();
    updateExceptionButton();
  }
});

load();
setInterval(update, 1000);
