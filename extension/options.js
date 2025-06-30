'use strict';

const modeEl = document.getElementById('mode');
const immediateEl = document.getElementById('immediate');
const breakDurationEl = document.getElementById('breakDuration');
const optBreakInput = document.getElementById('optBreakInput');
const optStart = document.getElementById('optStart');
const optStop = document.getElementById('optStop');
const optQuickBtns = document.querySelectorAll('.optQuick');
const patternsBody = document.querySelector('#patternsTable tbody');
const sessionsBody = document.querySelector('#sessionsTable tbody');
const patternsHeading = document.getElementById('patternsHeading');
const usageBody = document.querySelector('#usageTable tbody');
const usageChart = document.getElementById('usageChart');
const sortTimeHead = document.getElementById('sortTime');
const sortCountHead = document.getElementById('sortCount');

let usageSort = 'time';

let state = {
  mode: 'block',
  blockPatterns: [],
  allowPatterns: [],
  sessions: [],
  immediate: false,
  breakUntil: 0,
  breakDuration: 5
};

let usage = { totals: {}, sessions: [] };

async function load() {
  const data = await browser.storage.local.get([...Object.keys(state), 'usage']);
  const { usage: u, ...rest } = data;
  Object.assign(state, rest);
  if (u) usage = u;
  modeEl.value = state.mode;
  immediateEl.checked = state.immediate;
  breakDurationEl.value = state.breakDuration;
  optBreakInput.value = state.breakDuration;
  updatePatternsHeading();
  renderPatterns();
  renderSessions();
  renderUsage();
  drawChart();
  updateBreakControls();
}

function save() {
  return browser.storage.local.set(state);
}

function updateBreakControls() {
  if (state.breakUntil && Date.now() < state.breakUntil) {
    optStart.disabled = true;
    optQuickBtns.forEach(b => b.disabled = true);
    optBreakInput.disabled = true;
    optStop.style.display = 'inline-block';
  } else {
    optStart.disabled = false;
    optQuickBtns.forEach(b => b.disabled = false);
    optBreakInput.disabled = false;
    optStop.style.display = 'none';
  }
}

function updatePatternsHeading() {
  patternsHeading.textContent = state.mode === 'block' ? 'Block List' : 'Allow List';
}

function getActiveList() {
  return state.mode === 'block' ? state.blockPatterns : state.allowPatterns;
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

function formatDuration(ms) {
  const min = Math.floor(ms / 60000);
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function renderUsage() {
  usageBody.innerHTML = '';
  const entries = Object.entries(usage.totals);
  if (usageSort === 'count') {
    entries.sort((a, b) => (b[1].count || 0) - (a[1].count || 0));
  } else {
    entries.sort((a, b) => b[1].total - a[1].total);
  }
  entries.slice(0, 10).forEach(([domain, info]) => {
    const tr = document.createElement('tr');
    const tdDom = document.createElement('td');
    tdDom.textContent = domain;
    const tdTotal = document.createElement('td');
    tdTotal.textContent = formatDuration(info.total);
    const tdLast = document.createElement('td');
    tdLast.textContent = new Date(info.last).toLocaleString();
    const tdCount = document.createElement('td');
    tdCount.textContent = info.count || 0;
    const tdAct = document.createElement('td');
    const btn = document.createElement('button');
    btn.textContent = 'Remove';
    btn.addEventListener('click', () => removeDomain(domain));
    tdAct.appendChild(btn);
    tr.appendChild(tdDom);
    tr.appendChild(tdTotal);
    tr.appendChild(tdLast);
    tr.appendChild(tdCount);
    tr.appendChild(tdAct);
    usageBody.appendChild(tr);
  });
}

function drawChart() {
  if (!usageChart) return;
  const ctx = usageChart.getContext('2d');
  ctx.clearRect(0, 0, usageChart.width, usageChart.height);

  const padding = 30;
  const top = 10;
  const chartW = usageChart.width - padding - 10;
  const chartH = usageChart.height - padding - top;

  const end = Date.now();
  const start = end - 24 * 60 * 60 * 1000;
  const hours = new Array(24).fill(0);
  usage.sessions.forEach(s => {
    if (s.end <= start) return;
    const st = Math.max(start, s.start);
    const en = Math.min(end, s.end);
    let h = new Date(st).getHours();
    while (h <= new Date(en).getHours()) {
      const hourStart = new Date(new Date(st).setHours(h, 0, 0, 0)).getTime();
      const hourEnd = hourStart + 3600000;
      const overlap = Math.min(en, hourEnd) - Math.max(st, hourStart);
      if (overlap > 0) hours[h] += overlap;
      h++;
    }
  });

  const max = Math.max(...hours) || 1;
  const barW = chartW / 24;

  // axes
  ctx.strokeStyle = '#333';
  ctx.beginPath();
  ctx.moveTo(padding, top);
  ctx.lineTo(padding, top + chartH);
  ctx.lineTo(padding + chartW, top + chartH);
  ctx.stroke();

  ctx.fillStyle = '#5a9b8e';
  hours.forEach((val, i) => {
    const barH = (val / max) * chartH;
    ctx.fillRect(padding + i * barW + 1, top + chartH - barH, barW - 2, barH);
  });

  // Y axis ticks and labels
  ctx.fillStyle = '#000';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const y = top + chartH - (i / steps) * chartH;
    ctx.beginPath();
    ctx.moveTo(padding - 5, y);
    ctx.lineTo(padding, y);
    ctx.stroke();
    const label = formatDuration((max * i) / steps);
    ctx.fillText(label, padding - 7, y);
  }

  // X axis ticks and labels
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i < 24; i += 6) {
    const x = padding + i * barW + barW / 2;
    ctx.beginPath();
    ctx.moveTo(x, top + chartH);
    ctx.lineTo(x, top + chartH + 5);
    ctx.stroke();
    ctx.fillText(i.toString(), x, top + chartH + 7);
  }

  // axis titles
  ctx.textAlign = 'center';
  ctx.fillText('Time', padding + chartW / 2, usageChart.height - 2);
  ctx.save();
  ctx.translate(10, top + chartH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('Time Spent (hh:mm)', 0, 0);
  ctx.restore();
}

function removeDomain(domain) {
  delete usage.totals[domain];
  usage.sessions = usage.sessions.filter(s => s.domain !== domain);
  browser.storage.local.set({ usage }).then(() => {
    renderUsage();
    drawChart();
  });
}

modeEl.addEventListener('change', () => {
  state.mode = modeEl.value;
  updatePatternsHeading();
  save();
  renderPatterns();
});

immediateEl.addEventListener('change', () => {
  state.immediate = immediateEl.checked;
  save();
});

breakDurationEl.addEventListener('change', () => {
  state.breakDuration = parseInt(breakDurationEl.value, 10) || 0;
  save();
});

async function startBreak(duration) {
  const dur = duration || parseInt(optBreakInput.value,10) || state.breakDuration;
  const until = await browser.runtime.sendMessage({type:'start-break', duration:dur});
  state.breakUntil = until;
  updateBreakControls();
}

async function stopBreak() {
  await browser.runtime.sendMessage({type:'stop-break'});
  state.breakUntil = 0;
  updateBreakControls();
}

optStart.addEventListener('click', () => startBreak());
optQuickBtns.forEach(b => b.addEventListener('click', () => startBreak(parseInt(b.dataset.duration,10))));
optStop.addEventListener('click', stopBreak);

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

document.getElementById('addSession').addEventListener('click', () => {
  state.sessions.push({days: [1,2,3,4,5], start: '09:00', end: '17:00', break: 5});
  save();
  renderSessions();
});

if (sortTimeHead && sortCountHead) {
  sortTimeHead.addEventListener('click', () => {
    usageSort = 'time';
    renderUsage();
  });
  sortCountHead.addEventListener('click', () => {
    usageSort = 'count';
    renderUsage();
  });
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    for (const k of Object.keys(changes)) {
      if (k === 'usage') {
        usage = changes[k].newValue;
      } else {
        state[k] = changes[k].newValue;
      }
    }
    modeEl.value = state.mode;
    immediateEl.checked = state.immediate;
    breakDurationEl.value = state.breakDuration;
    optBreakInput.value = state.breakDuration;
    updatePatternsHeading();
    renderPatterns();
    renderSessions();
    renderUsage();
    drawChart();
    updateBreakControls();
  }
});

load();
