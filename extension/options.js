'use strict';

const modeEl = document.getElementById('mode');
const immediateEl = document.getElementById('immediate');
const breakDurationEl = document.getElementById('breakDuration');
const patternsBody = document.querySelector('#patternsTable tbody');
const sessionsBody = document.querySelector('#sessionsTable tbody');

let state = {
  mode: 'block',
  patterns: [],
  sessions: [],
  immediate: false,
  breakUntil: 0,
  breakDuration: 5
};

async function load() {
  const data = await browser.storage.local.get(Object.keys(state));
  Object.assign(state, data);
  modeEl.value = state.mode;
  immediateEl.checked = state.immediate;
  breakDurationEl.value = state.breakDuration;
  renderPatterns();
  renderSessions();
}

function save() {
  return browser.storage.local.set(state);
}

function renderPatterns() {
  patternsBody.innerHTML = '';
  state.patterns.forEach((p, i) => {
    const tr = document.createElement('tr');
    const tdIn = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = p;
    input.addEventListener('change', () => {
      if (input.value.trim()) {
        state.patterns[i] = input.value.trim();
      } else {
        state.patterns.splice(i, 1);
      }
      save();
      renderPatterns();
    });
    tdIn.appendChild(input);
    const tdAct = document.createElement('td');
    const btn = document.createElement('button');
    btn.textContent = 'Remove';
    btn.addEventListener('click', () => {
      state.patterns.splice(i, 1);
      save();
      renderPatterns();
    });
    tdAct.appendChild(btn);
    tr.appendChild(tdIn);
    tr.appendChild(tdAct);
    patternsBody.appendChild(tr);
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
    tr.appendChild(tdBreak);
    tr.appendChild(tdAct);
    sessionsBody.appendChild(tr);
  });
}

modeEl.addEventListener('change', () => {
  state.mode = modeEl.value;
  save();
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
  state.patterns.push(val);
  document.getElementById('newPattern').value = '';
  save();
  renderPatterns();
});

document.getElementById('addSession').addEventListener('click', () => {
  state.sessions.push({days: [1,2,3,4,5], start: '09:00', end: '17:00', break: 5});
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
    renderPatterns();
    renderSessions();
  }
});

load();
