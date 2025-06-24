let lists = [];
let currentIndex = 0;
let activeListId = null;
const selectEl = document.getElementById('listSelect');
const minutesEl = document.getElementById('minutes');
const breakEl = document.getElementById('break');
const countdownEl = document.getElementById('countdown');
const endBtn = document.getElementById('end');
const optionsLink = document.getElementById('openOptions');
const manualEl = document.getElementById('manual');
const statusEl = document.getElementById('status');

function inSchedule(list) {
  if (!list.start || !list.end) return true;
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = list.start.split(':').map(Number);
  const [eh, em] = list.end.split(':').map(Number);
  const startM = sh * 60 + sm;
  const endM = eh * 60 + em;
  if (startM <= endM) {
    return minutes >= startM && minutes <= endM;
  }
  return minutes >= startM || minutes <= endM;
}

function formatTime(ms) {
  const sec = Math.ceil(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

async function load() {
  const data = await browser.storage.local.get({lists: null, lastPopupIndex: 0, activeListId: null});
  if (!data.lists) {
    data.lists = [{id: Date.now(), name: 'Default Block', type: 'block', patterns: [], start: null, end: null, pomodoro: null, manual: null}];
    await browser.storage.local.set({lists: data.lists});
  }
  lists = data.lists.map(l => Object.assign({manual: null}, l));
  activeListId = data.activeListId !== null ? data.activeListId : lists[0].id;
  const active = lists.findIndex(l => l.id === activeListId);
  currentIndex = active !== -1 ? active : 0;
  minutesEl.value = '20';
  breakEl.value = '5';
  updateSelect();
  updateCountdown();
  manualEl.value = lists[currentIndex].manual || '';
  updateStatus();
}

function updateSelect() {
  selectEl.innerHTML = '';
  lists.forEach((l, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    const typeLabel = l.type === 'allow' ? ' (Allow Only)' : ' (Block)';
    opt.textContent = l.name + typeLabel + (l.id === activeListId ? ' [Active]' : '');
    selectEl.appendChild(opt);
  });
  selectEl.value = currentIndex;
  manualEl.value = lists[currentIndex].manual || '';
  if (lists[currentIndex] && lists[currentIndex].pomodoro &&
      typeof lists[currentIndex].pomodoro.breakMinutes === 'number') {
    breakEl.value = lists[currentIndex].pomodoro.breakMinutes || 0;
  }
}

async function save() {
  await browser.storage.local.set({lists, lastPopupIndex: currentIndex, activeListId});
}

selectEl.addEventListener('change', () => {
  currentIndex = parseInt(selectEl.value, 10);
  activeListId = lists[currentIndex].id;
  save();
  updateCountdown();
  manualEl.value = lists[currentIndex].manual || '';
  if (lists[currentIndex].pomodoro && typeof lists[currentIndex].pomodoro.breakMinutes === 'number') {
    breakEl.value = lists[currentIndex].pomodoro.breakMinutes;
  }
  updateStatus();
});

document.getElementById('start').addEventListener('click', async () => {
  const minutes = parseInt(minutesEl.value, 10);
  const breakMin = parseInt(breakEl.value, 10);
  if (!minutes || minutes <= 0) return;
  lists[currentIndex].pomodoro = {
    until: Date.now() + minutes * 60000,
    breakMinutes: isNaN(breakMin) || breakMin <= 0 ? 0 : breakMin,
    breakUntil: null
  };
  await save();
  minutesEl.value = '20';
  breakEl.value = '5';
  updateCountdown();
  updateStatus();
});

endBtn.addEventListener('click', async () => {
  if (!lists[currentIndex]) return;
  lists[currentIndex].pomodoro = null;
  await save();
  updateCountdown();
  breakEl.value = '5';
  updateStatus();
});

manualEl.addEventListener('change', () => {
  const list = lists[currentIndex];
  if (!list) return;
  list.manual = manualEl.value || null;
  save();
  updateStatus();
});

function updateCountdown() {
  const list = lists[currentIndex];
  if (!list || !list.pomodoro) {
    countdownEl.textContent = '';
    updateStatus();
    return;
  }
  const remain = list.pomodoro.until - Date.now();
  if (remain > 0) {
    countdownEl.textContent = formatTime(remain);
  } else if (list.pomodoro.breakUntil) {
    const breakRem = list.pomodoro.breakUntil - Date.now();
    if (breakRem > 0) {
      countdownEl.textContent = 'Break: ' + formatTime(breakRem);
    } else {
      list.pomodoro = null;
      save();
      countdownEl.textContent = '';
    }
  } else if (list.pomodoro.breakMinutes) {
    list.pomodoro.breakUntil = Date.now() + list.pomodoro.breakMinutes * 60000;
    save();
    countdownEl.textContent = 'Break: ' + formatTime(list.pomodoro.breakMinutes * 60000);
  } else {
    list.pomodoro = null;
    save();
    countdownEl.textContent = '';
  }
  updateStatus();
}

function computeStatus(list) {
  if (!list) return '';
  if (list.manual === 'block') return 'Blocked';
  if (list.manual === 'unblock') return 'Unblocked';
  if (list.pomodoro) {
    if (list.pomodoro.breakUntil && list.pomodoro.breakUntil > Date.now()) {
      return 'Break';
    }
    if (list.pomodoro.until > Date.now()) {
      return 'Blocked (Pomodoro)';
    }
  }
  if (list.start || list.end) {
    return inSchedule(list) ? 'Blocked (Scheduled)' : 'Unblocked';
  }
  return 'Unblocked';
}

function updateStatus() {
  const list = lists[currentIndex];
  statusEl.textContent = computeStatus(list);
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.lists) {
      lists = changes.lists.newValue.map(l => Object.assign({manual: null}, l));
    }
    if (changes.activeListId) {
      activeListId = changes.activeListId.newValue;
    }
    if (changes.lastPopupIndex) {
      currentIndex = changes.lastPopupIndex.newValue;
    }
    const active = lists.findIndex(l => l.id === activeListId);
    if (active !== -1) currentIndex = active;
    updateSelect();
    updateCountdown();
    updateStatus();
  }
});

setInterval(() => { updateCountdown(); updateStatus(); }, 1000);
optionsLink.addEventListener('click', (e) => {
  e.preventDefault();
  browser.runtime.openOptionsPage();
});
load();
