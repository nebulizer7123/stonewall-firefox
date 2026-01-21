'use strict';

const modeEl = document.getElementById('mode');
const immediateEl = document.getElementById('immediate');
const breakDurationEl = document.getElementById('breakDuration');
const patternsBody = document.querySelector('#patternsTable tbody');
const exceptionsSection = document.getElementById('exceptionsSection');
const exceptionsBody = document.querySelector('#exceptionsTable tbody');
const sessionsBody = document.querySelector('#sessionsTable tbody');
const patternsHeading = document.getElementById('patternsHeading');

let state = {
  mode: 'block',
  blockPatterns: ['reddit.com'],
  allowPatterns: [],
  exceptionPatterns: ['reddit.com/r/*/comments/'],
  sessions: [
    {
      id: 'default-session',
      days: [1,2,3,4,5],
      start: '08:00',
      end: '17:00',
      break: 15,
      breaksAllowed: 3
    }
  ],
  immediate: false,
  breakUntil: 0,
  breakDuration: 15
};

function generateSessionId() {
  return 'ses-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function normalizeSessions() {
  if (!Array.isArray(state.sessions)) {
    state.sessions = [];
    return true;
  }
  let changed = false;
  state.sessions.forEach((session) => {
    if (!session.id) {
      session.id = generateSessionId();
      changed = true;
    }
    if (typeof session.breaksAllowed !== 'number') {
      session.breaksAllowed = 0;
      changed = true;
    } else {
      const normalized = Math.max(0, Math.min(3, Math.round(session.breaksAllowed)));
      if (normalized !== session.breaksAllowed) {
        session.breaksAllowed = normalized;
        changed = true;
      }
    }
  });
  return changed;
}

async function load() {
  const data = await browser.storage.local.get(Object.keys(state));
  Object.assign(state, data);
  const needsSave = normalizeSessions();
  modeEl.value = state.mode;
  immediateEl.checked = state.immediate;
  breakDurationEl.value = state.breakDuration;
  updatePatternsHeading();
  renderPatterns();
  renderExceptions();
  renderSessions();
  updateExceptionsVisibility();
  if (needsSave) {
    save();
  }
}

function save() {
  return browser.storage.local.set(state);
}

function updatePatternsHeading() {
  patternsHeading.textContent = state.mode === 'block' ? 'Block List' : 'Allow List';
}

function getActiveList() {
  return state.mode === 'block' ? state.blockPatterns : state.allowPatterns;
}

function updateExceptionsVisibility() {
  if (exceptionsSection) {
    exceptionsSection.style.display = state.mode === 'block' ? 'block' : 'none';
  }
}

function renderPatterns() {
  patternsBody.innerHTML = '';
  const list = getActiveList();
  list.forEach((p, i) => {
    const tr = document.createElement('tr');
    const tdIn = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = p;
    input.addEventListener('change', () => {
      if (input.value.trim()) {
        list[i] = input.value.trim();
      } else {
        list.splice(i, 1);
      }
      save();
      renderPatterns();
    });
    tdIn.appendChild(input);
    const tdAct = document.createElement('td');
    const btn = document.createElement('button');
    btn.textContent = 'Remove';
    btn.addEventListener('click', () => {
      list.splice(i, 1);
      save();
      renderPatterns();
    });
    tdAct.appendChild(btn);
    tr.appendChild(tdIn);
    tr.appendChild(tdAct);
    patternsBody.appendChild(tr);
  });
}

function renderExceptions() {
  exceptionsBody.innerHTML = '';
  state.exceptionPatterns.forEach((p, i) => {
    const tr = document.createElement('tr');
    const tdIn = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = p;
    input.addEventListener('change', () => {
      if (input.value.trim()) {
        state.exceptionPatterns[i] = input.value.trim();
      } else {
        state.exceptionPatterns.splice(i, 1);
      }
      save();
      renderExceptions();
    });
    tdIn.appendChild(input);
    const tdAct = document.createElement('td');
    const btn = document.createElement('button');
    btn.textContent = 'Remove';
    btn.addEventListener('click', () => {
      state.exceptionPatterns.splice(i, 1);
      save();
      renderExceptions();
    });
    tdAct.appendChild(btn);
    tr.appendChild(tdIn);
    tr.appendChild(tdAct);
    exceptionsBody.appendChild(tr);
  });
}

function renderSessions() {
  sessionsBody.innerHTML = '';
  state.sessions.forEach((s, idx) => {
    const tr = document.createElement('tr');
    const tdDays = document.createElement('td');
    const days = ['S','M','T','W','T','F','S'];
    days.forEach((d, i) => {
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = s.days.includes(i);
      cb.addEventListener('change', () => {
        if (cb.checked) {
          if (!s.days.includes(i)) s.days.push(i);
        } else {
          s.days = s.days.filter(x => x !== i);
        }
        save();
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(d));
      tdDays.appendChild(label);
    });
    const tdStart = document.createElement('td');
    const start = document.createElement('input');
    start.type = 'time';
    start.value = s.start;
    start.addEventListener('change', () => {
      s.start = start.value;
      save();
    });
    tdStart.appendChild(start);
    const tdEnd = document.createElement('td');
    const end = document.createElement('input');
    end.type = 'time';
    end.value = s.end;
    end.addEventListener('change', () => {
      s.end = end.value;
      save();
    });
    tdEnd.appendChild(end);
    const tdAllowed = document.createElement('td');
    const allowed = document.createElement('select');
    [0, 1, 2, 3].forEach((count) => {
      const opt = document.createElement('option');
      opt.value = String(count);
      if (count === 0) {
        opt.textContent = 'No breaks';
      } else if (count === 1) {
        opt.textContent = '1 break';
      } else {
        opt.textContent = count + ' breaks';
      }
      allowed.appendChild(opt);
    });
    allowed.value = String(typeof s.breaksAllowed === 'number' ? s.breaksAllowed : 0);
    allowed.addEventListener('change', () => {
      s.breaksAllowed = parseInt(allowed.value, 10);
      save();
    });
    tdAllowed.appendChild(allowed);
    const tdBreak = document.createElement('td');
    const br = document.createElement('input');
    br.type = 'number';
    br.min = '0';
    br.value = s.break;
    br.addEventListener('change', () => {
      s.break = parseInt(br.value, 10) || 0;
      save();
    });
    tdBreak.appendChild(br);
    const tdAct = document.createElement('td');
    const rem = document.createElement('button');
    rem.textContent = 'Remove';
    rem.addEventListener('click', () => {
      state.sessions.splice(idx, 1);
      save();
      renderSessions();
    });
    tdAct.appendChild(rem);
    tr.appendChild(tdDays);
    tr.appendChild(tdStart);
    tr.appendChild(tdEnd);
    tr.appendChild(tdAllowed);
    tr.appendChild(tdBreak);
    tr.appendChild(tdAct);
    sessionsBody.appendChild(tr);
  });
}

modeEl.addEventListener('change', () => {
  state.mode = modeEl.value;
  updatePatternsHeading();
  save();
  renderPatterns();
  renderExceptions();
  updateExceptionsVisibility();
});

immediateEl.addEventListener('change', () => {
  state.immediate = immediateEl.checked;
  save();
});

breakDurationEl.addEventListener('change', () => {
  state.breakDuration = parseInt(breakDurationEl.value, 10) || 0;
  save();
});

document.getElementById('addPatternForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const val = document.getElementById('newPattern').value.trim();
  if (!val) return;
  const list = getActiveList();
  list.push(val);
  document.getElementById('newPattern').value = '';
  save();
  renderPatterns();
});

document.getElementById('addExceptionForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const val = document.getElementById('newException').value.trim();
  if (!val) return;
  state.exceptionPatterns.push(val);
  document.getElementById('newException').value = '';
  save();
  renderExceptions();
});

document.getElementById('addSession').addEventListener('click', () => {
  state.sessions.push({
    id: generateSessionId(),
    days: [1,2,3,4,5],
    start: '09:00',
    end: '17:00',
    break: 5,
    breaksAllowed: 0
  });
  save();
  renderSessions();
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    for (const k of Object.keys(changes)) {
      state[k] = changes[k].newValue;
    }
    modeEl.value = state.mode;
    immediateEl.checked = state.immediate;
    breakDurationEl.value = state.breakDuration;
    const normalized = normalizeSessions();
    updatePatternsHeading();
    renderPatterns();
    renderExceptions();
    renderSessions();
    updateExceptionsVisibility();
    if (normalized) {
      save();
    }
  }
});

load();
