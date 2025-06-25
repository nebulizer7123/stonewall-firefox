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

btn.addEventListener('click', () => startBreak());
quickBtns.forEach(b => {
  b.addEventListener('click', () => startBreak(parseInt(b.dataset.duration,10)));
});
stopBtn.addEventListener('click', stopBreak);

(async function init() {
  const data = await browser.storage.local.get(['breakUntil', 'breakDuration','resumeUrl']);
  breakUntil = data.breakUntil || 0;
  breakDuration = (data.breakDuration || 5) * 60000;
  durInput.value = data.breakDuration || 5;
  if (breakUntil > Date.now()) {
    btn.disabled = true;
    durInput.disabled = true;
    quickBtns.forEach(b => b.disabled = true);
    stopBtn.style.display = 'inline-block';
    updateTimer();
    intervalId = setInterval(updateTimer, 1000);
  }
})();
