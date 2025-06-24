'use strict';

const stateEl = document.getElementById('state');
const toggleBtn = document.getElementById('toggle');
const optionsLink = document.getElementById('openOptions');

let state = {
  immediate: false,
  breakUntil: 0
};

async function load() {
  const data = await browser.storage.local.get(['immediate','breakUntil']);
  Object.assign(state, data);
  update();
}

function update() {
  if (state.breakUntil && Date.now() < state.breakUntil) {
    const rem = Math.ceil((state.breakUntil - Date.now()) / 1000);
    stateEl.textContent = 'Break: ' + Math.floor(rem/60) + 'm ' + (rem%60) + 's';
    toggleBtn.textContent = 'Block Now';
    toggleBtn.disabled = true;
  } else if (state.immediate) {
    stateEl.textContent = 'Blocking';
    toggleBtn.textContent = 'Unblock';
    toggleBtn.disabled = false;
  } else {
    stateEl.textContent = 'Idle';
    toggleBtn.textContent = 'Block Now';
    toggleBtn.disabled = false;
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

optionsLink.addEventListener('click', (e) => {
  e.preventDefault();
  browser.runtime.openOptionsPage();
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.immediate) state.immediate = changes.immediate.newValue;
    if (changes.breakUntil) state.breakUntil = changes.breakUntil.newValue;
    update();
  }
});

load();
setInterval(update, 1000);
