'use strict';

const params = new URLSearchParams(location.search);
const purpose = params.get('purpose') === 'extra-break' ? 'extra-break' : 'settings';
const returnUrl = params.get('url') || '';
const duration = parseInt(params.get('duration'), 10) || 0;

const titleEl = document.getElementById('unlockTitle');
const hintEl = document.getElementById('unlockHint');
const statusEl = document.getElementById('unlockStatus');
const video = document.getElementById('preview');
const cancelBtn = document.getElementById('cancelBtn');
const doneBtn = document.getElementById('doneBtn');

const SCAN_INTERVAL_MS = 150;
const RETRY_DELAY_MS = 1500;

let stream = null;
let scanTimer = null;
let busy = false;

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

if (purpose === 'extra-break') {
  titleEl.textContent = 'Scan for an Extra Break';
  hintEl.textContent =
    'Scan your printed QR code to start a break outside your normal allowance.';
}

function setStatus(message) {
  statusEl.textContent = message || '';
}

function stopCamera() {
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
  }
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
}

async function closeTab() {
  try {
    const tab = await browser.tabs.getCurrent();
    if (tab) {
      await browser.tabs.remove(tab.id);
      return;
    }
  } catch (e) {
    // fall through
  }
  window.close();
}

function scanFrame() {
  if (busy || !stream || video.readyState < video.HAVE_CURRENT_DATA) return;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  if (!canvas.width || !canvas.height) return;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(image.data, image.width, image.height, {
    inversionAttempts: 'dontInvert'
  });
  if (code && code.data) {
    submitCode(code.data);
  }
}

async function submitCode(codeText) {
  busy = true;
  setStatus('Checking code…');
  let result;
  try {
    result = await browser.runtime.sendMessage({
      type: 'qr-unlock',
      code: codeText,
      purpose,
      url: returnUrl,
      duration
    });
  } catch (err) {
    const reason = err && (err.code || err.message);
    if (reason === 'bad-code') {
      setStatus('That is not the right code. Try again.');
    } else if (reason === 'no-lock') {
      setStatus('No lock is set up, so there is nothing to unlock.');
      stopCamera();
      return;
    } else {
      setStatus('Something went wrong. Try again.');
    }
    setTimeout(() => {
      setStatus('');
      busy = false;
    }, RETRY_DELAY_MS);
    return;
  }
  stopCamera();
  if (result && result.purpose === 'extra-break') {
    if (returnUrl) {
      location.href = returnUrl;
      return;
    }
    setStatus('Break started. You can close this tab.');
    cancelBtn.textContent = 'Close';
    return;
  }
  if (returnUrl) {
    // Came from a blocked page (e.g. to add an exception); go back so the
    // now-unlocked controls are available.
    setStatus('Settings unlocked. Returning…');
    location.href = returnUrl;
    return;
  }
  setStatus('Settings unlocked for 15 minutes.');
  cancelBtn.textContent = 'Close';
  doneBtn.style.display = 'inline-block';
}

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
  } catch (e) {
    setStatus('Camera access is required to scan your unlock code.');
    return;
  }
  video.srcObject = stream;
  scanTimer = setInterval(scanFrame, SCAN_INTERVAL_MS);
}

cancelBtn.addEventListener('click', () => {
  stopCamera();
  if (returnUrl && purpose === 'extra-break' && cancelBtn.textContent === 'Cancel') {
    location.href = returnUrl;
    return;
  }
  closeTab();
});

doneBtn.addEventListener('click', () => {
  browser.runtime.openOptionsPage();
  closeTab();
});

window.addEventListener('unload', stopCamera);

startCamera();
