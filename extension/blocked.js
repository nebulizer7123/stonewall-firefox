const params = new URLSearchParams(location.search);
const url = params.get('url') || '';
document.getElementById('msg').textContent = `The following URL is blocked: ${url}`;

document.getElementById('unblock').addEventListener('click', () => {
  browser.runtime.sendMessage({type: 'unblockUrl', url});
  window.history.back();
});
