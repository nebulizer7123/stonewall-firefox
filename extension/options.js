let lists = [];
let currentIndex = 0;

async function ensureLists() {
  const data = await browser.storage.local.get({lists: null, blocked: []});
  if (!data.lists) {
    data.lists = [{
      id: Date.now(),
      name: 'Default Block',
      type: 'block',
      patterns: data.blocked.map(e => e.pattern),
      start: null,
      end: null,
      pomodoro: null
    }];
    await browser.storage.local.set({lists: data.lists, blocked: []});
  }
  lists = data.lists;
  return data;
}

async function load() {
  const data = await ensureLists();
  updateListSelector();
  updateStats(data.timeSpent || {});
  showList(currentIndex);
  updatePomodoroDisplay();
}

function updateListSelector() {
  const select = document.getElementById('lists');
  select.innerHTML = '';
  lists.forEach((l, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = l.name;
    select.appendChild(opt);
  });
  if (lists.length) select.value = currentIndex;
}

document.getElementById('lists').addEventListener('change', (e) => {
  currentIndex = parseInt(e.target.value, 10);
  showList(currentIndex);
});

document.getElementById('addListBtn').addEventListener('click', async () => {
  lists.push({id: Date.now(), name: 'New List', type: 'block', patterns: [], start: null, end: null, pomodoro: null});
  currentIndex = lists.length - 1;
  await saveLists();
});

async function saveLists() {
  await browser.storage.local.set({lists});
  updateListSelector();
  showList(currentIndex);
}

function showList(index) {
  if (!lists[index]) return;
  const list = lists[index];
  document.getElementById('listName').value = list.name;
  document.getElementById('listType').value = list.type;
  document.getElementById('listStart').value = list.start || '';
  document.getElementById('listEnd').value = list.end || '';
  renderPatterns(list);
  updatePomodoroDisplay();
}

function renderPatterns(list) {
  const tbody = document.querySelector('#patternsTable tbody');
  tbody.innerHTML = '';
  list.patterns.forEach((p, i) => {
    const tr = document.createElement('tr');
    const tdIn = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = p;
    const saveInput = async () => {
      const val = input.value.trim();
      if (val) {
        list.patterns[i] = val;
      } else {
        list.patterns.splice(i, 1);
      }

      await saveLists();
    };
    input.addEventListener('blur', saveInput);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        input.blur();
      }
    });
    tdIn.appendChild(input);
    const tdAct = document.createElement('td');
    const remove = document.createElement('button');
    remove.textContent = 'Remove';
    remove.addEventListener('click', async () => {
      list.patterns.splice(i, 1);
      await saveLists();
    });
    tdAct.appendChild(remove);
    tr.appendChild(tdIn);
    tr.appendChild(tdAct);
    tbody.appendChild(tr);
  });
}

const listNameEl = document.getElementById('listName');
const listTypeEl = document.getElementById('listType');
const listStartEl = document.getElementById('listStart');
const listEndEl = document.getElementById('listEnd');
const pomodoroEl = document.getElementById('pomodoroCountdown');

function updatePomodoroDisplay() {
  const list = lists[currentIndex];
  if (!list || !list.pomodoro) {
    pomodoroEl.textContent = '';
    return;
  }
  const remaining = list.pomodoro.until - Date.now();
  if (remaining > 0) {
    pomodoroEl.textContent = formatTime(Math.ceil(remaining / 1000));
  } else {
    pomodoroEl.textContent = '';
    list.pomodoro = null;
    saveLists();
  }
}

function saveCurrentListFields() {
  const list = lists[currentIndex];

  list.name = listNameEl.value.trim() || 'Unnamed';
  list.type = listTypeEl.value;
  list.start = listStartEl.value || null;
  list.end = listEndEl.value || null;
  return saveLists();
}

document.getElementById('saveListSettings').addEventListener('click', saveCurrentListFields);

listNameEl.addEventListener('blur', saveCurrentListFields);
listTypeEl.addEventListener('change', saveCurrentListFields);
listStartEl.addEventListener('change', saveCurrentListFields);
listEndEl.addEventListener('change', saveCurrentListFields);

document.getElementById('addPatternForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const val = document.getElementById('newPattern').value.trim();
  if (!val) return;
  lists[currentIndex].patterns.push(val);
  document.getElementById('newPattern').value = '';
  await saveLists();
});

document.getElementById('startPomodoro').addEventListener('click', async () => {
  const minutes = parseInt(document.getElementById('pomodoroMinutes').value, 10);
  if (isNaN(minutes) || minutes <= 0) return;
  lists[currentIndex].pomodoro = {until: Date.now() + minutes * 60000};
  document.getElementById('pomodoroMinutes').value = '';
  await saveLists();
  updatePomodoroDisplay();
});

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

function updateStats(stats) {
  const ul = document.getElementById('statsList');
  ul.innerHTML = '';
  const entries = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  entries.forEach(([domain, seconds]) => {
    const tr = document.createElement('tr');
    const tdDom = document.createElement('td');
    tdDom.textContent = domain;
    const tdTime = document.createElement('td');
    tdTime.textContent = formatTime(seconds);
    const tdAct = document.createElement('td');
    const btn = document.createElement('button');
    btn.textContent = 'Remove';
    btn.addEventListener('click', async () => {
      const data = await browser.storage.local.get({timeSpent: {}});
      delete data.timeSpent[domain];
      await browser.storage.local.set({timeSpent: data.timeSpent});
      load();
    });
    tdAct.appendChild(btn);
    tr.appendChild(tdDom);
    tr.appendChild(tdTime);
    tr.appendChild(tdAct);
    ul.appendChild(tr);
  });
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.lists) {
      lists = changes.lists.newValue;
      updateListSelector();
      showList(currentIndex);
    }
    if (changes.timeSpent) updateStats(changes.timeSpent.newValue);
  }
});

setInterval(updatePomodoroDisplay, 1000);

load();
