let lists = [];
let currentIndex = 0;
const selectEl = document.getElementById('listSelect');
const minutesEl = document.getElementById('minutes');
const countdownEl = document.getElementById('countdown');

function formatTime(ms) {
  const sec = Math.ceil(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

async function load() {
  const data = await browser.storage.local.get({lists: null});
  if (!data.lists) {
    data.lists = [{id: Date.now(), name: 'Default Block', type: 'block', patterns: [], start: null, end: null, pomodoro: null}];
    await browser.storage.local.set({lists: data.lists});
  }
  lists = data.lists;
  updateSelect();
  updateCountdown();
}

function updateSelect() {
  selectEl.innerHTML = '';
  lists.forEach((l, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = l.name + (l.type === 'allow' ? ' (Allow Only)' : ' (Block)');
    selectEl.appendChild(opt);
  });
  selectEl.value = currentIndex;
}

async function save() {
  await browser.storage.local.set({lists});
}

selectEl.addEventListener('change', () => {
  currentIndex = parseInt(selectEl.value, 10);
  updateCountdown();
});

document.getElementById('start').addEventListener('click', async () => {
  const minutes = parseInt(minutesEl.value, 10);
  if (!minutes || minutes <= 0) return;
  lists[currentIndex].pomodoro = {until: Date.now() + minutes * 60000};
  await save();
  minutesEl.value = '';
  updateCountdown();
});

function updateCountdown() {
  const list = lists[currentIndex];
  if (!list || !list.pomodoro) {
    countdownEl.textContent = '';
    return;
  }
  const remain = list.pomodoro.until - Date.now();
  if (remain > 0) {
    countdownEl.textContent = formatTime(remain);
  } else {
    list.pomodoro = null;
    save();
    countdownEl.textContent = '';
  }
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.lists) {
    lists = changes.lists.newValue;
    updateSelect();
    updateCountdown();
  }
});

setInterval(updateCountdown, 1000);
load();
