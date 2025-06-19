async function load() {
  const data = await browser.storage.local.get({blocked: []});
  updateUI(data.blocked);
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

load();
