let lists = [];
let currentIndex = 0;
const selectEl = document.getElementById('listSelect');
const minutesEl = document.getElementById('minutes');
const countdownEl = document.getElementById('countdown');
const endBtn = document.getElementById('end');
const optionsLink = document.getElementById('openOptions');


function formatTime(ms) {
  const sec = Math.ceil(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

async function load() {
  const data = await browser.storage.local.get({lists: null, lastPopupIndex: 0});

  if (!data.lists) {
    data.lists = [{id: Date.now(), name: 'Default Block', type: 'block', patterns: [], start: null, end: null, pomodoro: null}];
    await browser.storage.local.set({lists: data.lists});
  }
  lists = data.lists;
  const active = lists.findIndex(l => l.pomodoro && l.pomodoro.until > Date.now());
  currentIndex = active !== -1 ? active : data.lastPopupIndex || 0;

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
  await browser.storage.local.set({lists, lastPopupIndex: currentIndex});

}

selectEl.addEventListener('change', () => {
  currentIndex = parseInt(selectEl.value, 10);
  save();

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

endBtn.addEventListener('click', async () => {
  if (!lists[currentIndex]) return;
  lists[currentIndex].pomodoro = null;
  await save();
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
  if (area === 'local') {
    if (changes.lists) {
      lists = changes.lists.newValue;
    }
    if (changes.lastPopupIndex) {
      currentIndex = changes.lastPopupIndex.newValue;
    }
    const active = lists.findIndex(l => l.pomodoro && l.pomodoro.until > Date.now());
    if (active !== -1) currentIndex = active;

    updateSelect();
    updateCountdown();
  }
});

setInterval(updateCountdown, 1000);

optionsLink.addEventListener('click', (e) => {
  e.preventDefault();
  browser.runtime.openOptionsPage();
});

load();
