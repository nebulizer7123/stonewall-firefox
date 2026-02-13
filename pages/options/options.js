'use strict';

const themeApi = window.stonewallTheme || {};
const THEME_MODE_LIGHT = themeApi.MODE_LIGHT || 'light';
const THEME_MODE_DARK = themeApi.MODE_DARK || 'dark';
const THEME_STYLE_CLASSIC = themeApi.STYLE_CLASSIC || 'classic';
const THEME_STYLE_NEON = themeApi.STYLE_NEON || 'neon';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getDefaultPalette(mode) {
  if (themeApi && typeof themeApi.getDefaultPalette === 'function') {
    return themeApi.getDefaultPalette(mode);
  }
  if (mode === THEME_MODE_DARK) {
    return {
      background: '#161326',
      surface: '#211d35',
      text: '#f5ecff',
      accent: '#36f2ff',
      button: '#d4553e',
      buttonText: '#fff7f2'
    };
  }
  return {
    background: '#ffffff',
    surface: '#ffffff',
    text: '#1f1d24',
    accent: '#16b7e8',
    button: '#b64b36',
    buttonText: '#ffffff'
  };
}

function createDefaultThemeSettings(mode = THEME_MODE_LIGHT, style = THEME_STYLE_CLASSIC) {
  if (themeApi && typeof themeApi.createDefaultSettings === 'function') {
    return themeApi.createDefaultSettings(mode, style);
  }
  const normalizedMode = mode === THEME_MODE_DARK ? THEME_MODE_DARK : THEME_MODE_LIGHT;
  const normalizedStyle = style === THEME_STYLE_NEON ? THEME_STYLE_NEON : THEME_STYLE_CLASSIC;
  return {
    mode: normalizedMode,
    style: normalizedStyle,
    palettes: {
      light: getDefaultPalette(THEME_MODE_LIGHT),
      dark: getDefaultPalette(THEME_MODE_DARK)
    }
  };
}

function normalizeThemeSettings(value) {
  if (themeApi && typeof themeApi.normalizeThemeSettings === 'function') {
    return themeApi.normalizeThemeSettings(value);
  }
  const fallback = createDefaultThemeSettings();
  if (!value || typeof value !== 'object') return fallback;
  const normalizedMode = value.mode === THEME_MODE_DARK ? THEME_MODE_DARK : THEME_MODE_LIGHT;
  const normalizedStyle = value.style === THEME_STYLE_NEON ? THEME_STYLE_NEON : THEME_STYLE_CLASSIC;
  const palettes = value.palettes && typeof value.palettes === 'object' ? value.palettes : {};
  return {
    mode: normalizedMode,
    style: normalizedStyle,
    palettes: {
      light: Object.assign({}, getDefaultPalette(THEME_MODE_LIGHT), palettes.light || {}),
      dark: Object.assign({}, getDefaultPalette(THEME_MODE_DARK), palettes.dark || {})
    }
  };
}

function applyThemeLocally(themeSettings) {
  if (themeApi && typeof themeApi.applyTheme === 'function') {
    themeApi.applyTheme(themeSettings);
  }
}

const modeEl = document.getElementById('mode');
const patternsBody = document.querySelector('#patternsTable tbody');
const exceptionsSection = document.getElementById('exceptionsSection');
const exceptionsBody = document.querySelector('#exceptionsTable tbody');
const sessionsBody = document.querySelector('#sessionsTable tbody');
const patternsHeading = document.getElementById('patternsHeading');

const tabButtons = Array.from(document.querySelectorAll('.options-tab'));
const tabPanels = Array.from(document.querySelectorAll('.options-panel'));

const themeStyleEl = document.getElementById('themeStyle');
const themeModeEl = document.getElementById('themeMode');
const themeInputs = {
  background: document.getElementById('themeBackground'),
  surface: document.getElementById('themeSurface'),
  text: document.getElementById('themeText'),
  accent: document.getElementById('themeAccent'),
  button: document.getElementById('themeButton'),
  buttonText: document.getElementById('themeButtonText')
};
const resetThemeModeBtn = document.getElementById('resetThemeMode');
const resetThemeAllBtn = document.getElementById('resetThemeAll');

let state = {
  mode: 'block',
  blockPatterns: ['reddit.com'],
  allowPatterns: [],
  exceptionPatterns: ['reddit.com/r/*/comments/'],
  sessions: [
    {
      id: 'default-session',
      days: [1, 2, 3, 4, 5],
      start: '08:00',
      end: '17:00',
      break: 15,
      breaksAllowed: 3
    }
  ],
  immediate: false,
  breakUntil: 0,
  breakDuration: 15,
  themeSettings: createDefaultThemeSettings(THEME_MODE_LIGHT)
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
  state.themeSettings = normalizeThemeSettings(state.themeSettings);
  modeEl.value = state.mode;
  updatePatternsHeading();
  renderPatterns();
  renderExceptions();
  renderSessions();
  updateExceptionsVisibility();
  renderThemeControls();
  applyThemeLocally(state.themeSettings);
  setActiveTab('blockingPanel');
  if (needsSave) {
    save();
  }
}

function save() {
  return browser.storage.local.set(state);
}

function saveThemeSettings() {
  return browser.storage.local.set({ themeSettings: state.themeSettings });
}

function updatePatternsHeading() {
  patternsHeading.textContent = state.mode === 'block' ? 'Block List' : 'Focus List';
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
  list.forEach((pattern, index) => {
    const tr = document.createElement('tr');
    const tdIn = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = pattern;
    input.addEventListener('change', () => {
      if (input.value.trim()) {
        list[index] = input.value.trim();
      } else {
        list.splice(index, 1);
      }
      save();
      renderPatterns();
    });
    tdIn.appendChild(input);

    const tdAct = document.createElement('td');
    const btn = document.createElement('button');
    btn.textContent = 'Remove';
    btn.addEventListener('click', () => {
      list.splice(index, 1);
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
  state.exceptionPatterns.forEach((pattern, index) => {
    const tr = document.createElement('tr');
    const tdIn = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = pattern;
    input.addEventListener('change', () => {
      if (input.value.trim()) {
        state.exceptionPatterns[index] = input.value.trim();
      } else {
        state.exceptionPatterns.splice(index, 1);
      }
      save();
      renderExceptions();
    });
    tdIn.appendChild(input);

    const tdAct = document.createElement('td');
    const btn = document.createElement('button');
    btn.textContent = 'Remove';
    btn.addEventListener('click', () => {
      state.exceptionPatterns.splice(index, 1);
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
  state.sessions.forEach((session, idx) => {
    const tr = document.createElement('tr');

    const tdDays = document.createElement('td');
    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    dayLabels.forEach((day, dayIndex) => {
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = session.days.includes(dayIndex);
      cb.addEventListener('change', () => {
        if (cb.checked) {
          if (!session.days.includes(dayIndex)) session.days.push(dayIndex);
        } else {
          session.days = session.days.filter((value) => value !== dayIndex);
        }
        save();
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(day));
      tdDays.appendChild(label);
    });

    const tdStart = document.createElement('td');
    const start = document.createElement('input');
    start.type = 'time';
    start.value = session.start;
    start.addEventListener('change', () => {
      session.start = start.value;
      save();
    });
    tdStart.appendChild(start);

    const tdEnd = document.createElement('td');
    const end = document.createElement('input');
    end.type = 'time';
    end.value = session.end;
    end.addEventListener('change', () => {
      session.end = end.value;
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
    allowed.value = String(typeof session.breaksAllowed === 'number' ? session.breaksAllowed : 0);
    allowed.addEventListener('change', () => {
      session.breaksAllowed = parseInt(allowed.value, 10);
      save();
    });
    tdAllowed.appendChild(allowed);

    const tdBreak = document.createElement('td');
    const br = document.createElement('input');
    br.type = 'number';
    br.min = '0';
    br.value = session.break;
    br.addEventListener('change', () => {
      session.break = parseInt(br.value, 10) || 0;
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

function setActiveTab(panelId) {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.panel === panelId;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });

  tabPanels.forEach((panel) => {
    const isActive = panel.id === panelId;
    panel.classList.toggle('is-active', isActive);
    panel.hidden = !isActive;
  });
}

function initTabs() {
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setActiveTab(button.dataset.panel);
    });
  });
}

function renderThemeControls() {
  if (!themeModeEl) return;
  const themeSettings = normalizeThemeSettings(state.themeSettings);
  state.themeSettings = themeSettings;

  const mode = themeSettings.mode;
  const style = themeSettings.style;
  if (themeStyleEl) {
    themeStyleEl.value = style;
  }
  themeModeEl.value = mode;

  const palette = themeSettings.palettes[mode];
  Object.keys(themeInputs).forEach((key) => {
    const input = themeInputs[key];
    if (!input) return;
    input.value = palette[key];
  });
}

function setThemeMode(mode) {
  const themeSettings = normalizeThemeSettings(state.themeSettings);
  themeSettings.mode = mode === THEME_MODE_DARK ? THEME_MODE_DARK : THEME_MODE_LIGHT;
  state.themeSettings = themeSettings;
  applyThemeLocally(state.themeSettings);
  saveThemeSettings();
  renderThemeControls();
}

function setThemeStyle(style) {
  const themeSettings = normalizeThemeSettings(state.themeSettings);
  themeSettings.style = style === THEME_STYLE_NEON ? THEME_STYLE_NEON : THEME_STYLE_CLASSIC;
  state.themeSettings = themeSettings;
  applyThemeLocally(state.themeSettings);
  saveThemeSettings();
  renderThemeControls();
}

function updateThemeColor(key, value) {
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) return;
  const themeSettings = normalizeThemeSettings(state.themeSettings);
  const mode = themeSettings.mode;
  const next = clone(themeSettings);
  next.palettes[mode][key] = value.toLowerCase();
  state.themeSettings = next;
  applyThemeLocally(state.themeSettings);
  saveThemeSettings();
}

function resetCurrentModePalette() {
  const themeSettings = normalizeThemeSettings(state.themeSettings);
  const next = clone(themeSettings);
  next.palettes[next.mode] = getDefaultPalette(next.mode);
  state.themeSettings = next;
  applyThemeLocally(state.themeSettings);
  saveThemeSettings();
  renderThemeControls();
}

function resetAllThemeSettings() {
  state.themeSettings = createDefaultThemeSettings(THEME_MODE_LIGHT);
  applyThemeLocally(state.themeSettings);
  saveThemeSettings();
  renderThemeControls();
}

function bindThemeEvents() {
  if (themeStyleEl) {
    themeStyleEl.addEventListener('change', () => {
      setThemeStyle(themeStyleEl.value);
    });
  }

  if (themeModeEl) {
    themeModeEl.addEventListener('change', () => {
      setThemeMode(themeModeEl.value);
    });
  }

  Object.keys(themeInputs).forEach((key) => {
    const input = themeInputs[key];
    if (!input) return;
    input.addEventListener('input', () => {
      updateThemeColor(key, input.value);
    });
  });

  if (resetThemeModeBtn) {
    resetThemeModeBtn.addEventListener('click', () => {
      resetCurrentModePalette();
    });
  }

  if (resetThemeAllBtn) {
    resetThemeAllBtn.addEventListener('click', () => {
      resetAllThemeSettings();
    });
  }
}

modeEl.addEventListener('change', () => {
  state.mode = modeEl.value;
  updatePatternsHeading();
  save();
  renderPatterns();
  renderExceptions();
  updateExceptionsVisibility();
});

document.getElementById('addPatternForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const val = document.getElementById('newPattern').value.trim();
  if (!val) return;
  const list = getActiveList();
  list.push(val);
  document.getElementById('newPattern').value = '';
  save();
  renderPatterns();
});

document.getElementById('addExceptionForm').addEventListener('submit', (event) => {
  event.preventDefault();
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
    days: [1, 2, 3, 4, 5],
    start: '09:00',
    end: '17:00',
    break: 5,
    breaksAllowed: 0
  });
  save();
  renderSessions();
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  Object.keys(changes).forEach((key) => {
    state[key] = changes[key].newValue;
  });

  modeEl.value = state.mode;
  const normalized = normalizeSessions();
  state.themeSettings = normalizeThemeSettings(state.themeSettings);

  updatePatternsHeading();
  renderPatterns();
  renderExceptions();
  renderSessions();
  updateExceptionsVisibility();
  renderThemeControls();
  applyThemeLocally(state.themeSettings);

  if (normalized) {
    save();
  }
});

initTabs();
bindThemeEvents();
load();
