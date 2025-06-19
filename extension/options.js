async function load() {
  const data = await browser.storage.local.get({blocked: [], timeSpent: {}});
  updateUI(data.blocked);
  updateStats(data.timeSpent);

}

function updateUI(list) {
  const ul = document.getElementById('blockedList');
  ul.innerHTML = '';
  list.forEach((entry, index) => {
    const li = document.createElement('li');
    const text = entry.pattern + (entry.start ? ` (${entry.start}-${entry.end})` : '');
    li.textContent = text + ' ';
    const btn = document.createElement('button');
    btn.textContent = 'Remove';
    btn.addEventListener('click', async () => {
      list.splice(index, 1);
      await browser.storage.local.set({blocked: list});
      load();
    });
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

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
    const li = document.createElement('li');
    li.textContent = `${domain}: ${formatTime(seconds)}`;
    ul.appendChild(li);
  });
}

document.getElementById('addForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pattern = document.getElementById('pattern').value.trim();
  const start = document.getElementById('start').value;
  const end = document.getElementById('end').value;
  if (!pattern) return;
  const data = await browser.storage.local.get({blocked: []});
  data.blocked.push({pattern, start: start || null, end: end || null});
  await browser.storage.local.set({blocked: data.blocked});
  document.getElementById('pattern').value = '';
  document.getElementById('start').value = '';
  document.getElementById('end').value = '';
  load();
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.blocked) updateUI(changes.blocked.newValue);
    if (changes.timeSpent) updateStats(changes.timeSpent.newValue);
  }
});


load();
