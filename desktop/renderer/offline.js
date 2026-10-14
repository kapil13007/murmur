// File: desktop/renderer/offline.js
// Shown in the hub window when the backend is down; reloads the hub as soon
// as the server answers again.
(() => {
  const target = new URLSearchParams(window.location.search).get('url') || '';
  if (!/^https?:\/\//.test(target)) return;
  document.getElementById('url').textContent = target;
  const status = document.getElementById('status');
  let attempt = 0;
  let timer = null;

  async function check() {
    clearTimeout(timer);
    attempt += 1;
    status.textContent = `Checking… (attempt ${attempt})`;
    try {
      // Opaque response is enough: it means something is listening.
      await fetch(target, { mode: 'no-cors', cache: 'no-store' });
      status.textContent = 'Connected. Loading…';
      window.location.replace(target);
    } catch {
      status.textContent = 'Still offline. Retrying in a few seconds…';
      timer = setTimeout(check, 3000);
    }
  }

  document.getElementById('retry').addEventListener('click', check);
  timer = setTimeout(check, 1500);
})();
