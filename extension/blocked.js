'use strict';

const params = new URLSearchParams(location.search);
const url = params.get('url') || '';
const msgEl = document.getElementById('msg');
const btn = document.getElementById('breakBtn');
const timerEl = document.getElementById('breakTimer');
const progress = document.getElementById('progressBar');

let breakUntil = 0;
let breakDuration = 0; // ms
let intervalId = null;

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
    breakUntil = 0;
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

async function startBreak() {
  const until = await browser.runtime.sendMessage({ type: 'start-break' });
  const data = await browser.storage.local.get(['breakDuration']);
  breakDuration = (data.breakDuration || 5) * 60000;
  breakUntil = until;
  btn.disabled = true;
  updateTimer();
  if (!intervalId) intervalId = setInterval(updateTimer, 1000);
}

btn.addEventListener('click', startBreak);

(async function init() {
  const data = await browser.storage.local.get(['breakUntil', 'breakDuration']);
  breakUntil = data.breakUntil || 0;
  breakDuration = (data.breakDuration || 5) * 60000;
  if (breakUntil > Date.now()) {
    btn.disabled = true;
    updateTimer();
    intervalId = setInterval(updateTimer, 1000);
  }
})();
