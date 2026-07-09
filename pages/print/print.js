'use strict';

const qrContainer = document.getElementById('qrContainer');
const printBtn = document.getElementById('printBtn');
const confirmBtn = document.getElementById('confirmBtn');
const printMsg = document.getElementById('printMsg');
const printIntro = document.getElementById('printIntro');
const printActions = document.getElementById('printActions');

let printed = false;

function showEmptyState() {
  printIntro.style.display = 'none';
  printActions.style.display = 'none';
  qrContainer.style.display = 'none';
  printMsg.textContent =
    'No unlock code is waiting to be printed. Enable the lock from Stonewall Preferences to generate one.';
}

function renderQr(secret) {
  const qr = qrcode(0, 'M');
  qr.addData(secret);
  qr.make();
  const cells = qr.getModuleCount();
  const cellSize = 8;
  const margin = cellSize * 4;
  const size = cells * cellSize + margin * 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000000';
  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < cells; col++) {
      if (qr.isDark(row, col)) {
        ctx.fillRect(margin + col * cellSize, margin + row * cellSize, cellSize, cellSize);
      }
    }
  }
  qrContainer.appendChild(canvas);
}

printBtn.addEventListener('click', () => {
  printed = true;
  confirmBtn.disabled = false;
  window.print();
});

confirmBtn.addEventListener('click', async () => {
  if (!printed) return;
  try {
    await browser.runtime.sendMessage({ type: 'confirm-lock' });
  } catch (e) {
    printMsg.textContent = 'Could not enable the lock. Reopen this page from Preferences and try again.';
    return;
  }
  printBtn.disabled = true;
  confirmBtn.disabled = true;
  qrContainer.style.display = 'none';
  printIntro.style.display = 'none';
  printMsg.textContent =
    'Settings are now locked. Put the printout somewhere out of reach, then close this tab.';
});

(async function init() {
  let secret = '';
  try {
    secret = await browser.runtime.sendMessage({ type: 'get-print-secret' });
  } catch (e) {
    // fall through to empty state
  }
  if (!secret) {
    showEmptyState();
    return;
  }
  renderQr(secret);
})();
