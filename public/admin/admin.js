// /admin/: approve or reject answers and download CSVs. Not linked from the site.
import { createAdmin } from './client.js';

const $ = (id) => document.getElementById(id);

// sessionStorage can throw when storage is blocked; fall back to memory for this tab.
let storage;
try {
  storage = sessionStorage;
  storage.getItem('x');
} catch {
  const mem = new Map();
  storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
}
const admin = createAdmin(storage);

const say = (text) => { $('alert').textContent = text; };

function locked(message = '') {
  $('panel').hidden = true;
  $('unlock').hidden = false;
  $('rows').replaceChildren();
  say(message);
}

function fail(err) {
  if (err.status === 401) locked(err.message);
  else say(err.message);
}

function renderRows() {
  const { rows, status } = admin.state;
  $('rows-empty').hidden = rows.length > 0;
  $('rows').replaceChildren(...rows.map((r) => {
    const li = document.createElement('li');
    li.className = 'card row';
    const date = document.createElement('span');
    date.className = 'muted small';
    date.textContent = new Date(r.created_at).toLocaleString();
    const text = document.createElement('p');
    text.className = 'row-text';
    text.textContent = r.text;
    const buttons = document.createElement('div');
    buttons.className = 'actions';
    for (const [to, label, cls] of [['approved', 'Approve', 'btn'], ['rejected', 'Reject', 'btn-ghost']]) {
      if (to === status) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = cls;
      b.textContent = label;
      b.addEventListener('click', async () => {
        b.disabled = true;
        try {
          await admin.setStatus(r.id, to);
          say('');
          renderRows();
        } catch (err) {
          b.disabled = false;
          fail(err);
        }
      });
      buttons.append(b);
    }
    li.append(date, text, buttons);
    return li;
  }));
}

async function openTab(status) {
  for (const tab of document.querySelectorAll('[role="tab"]')) tab.setAttribute('aria-selected', String(tab.dataset.status === status));
  $('rows-panel').setAttribute('aria-labelledby', `tab-${status}`);
  try {
    await admin.list(status);
    say('');
    renderRows();
  } catch (err) {
    fail(err);
  }
}

async function unlocked() {
  $('unlock').hidden = true;
  $('panel').hidden = false;
  await openTab('pending');
}

$('unlock').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await admin.unlock($('pass').value);
    $('pass').value = '';
    say('');
    $('unlock').hidden = true;
    $('panel').hidden = false;
    for (const tab of document.querySelectorAll('[role="tab"]')) tab.setAttribute('aria-selected', String(tab.dataset.status === 'pending'));
    renderRows();
  } catch (err) {
    fail(err);
  }
});

$('lock').addEventListener('click', () => {
  admin.lock();
  locked('Locked.');
});

for (const tab of document.querySelectorAll('[role="tab"]')) tab.addEventListener('click', () => openTab(tab.dataset.status));

for (const b of document.querySelectorAll('[data-table]')) {
  b.addEventListener('click', async () => {
    b.disabled = true;
    try {
      const blob = await admin.csv(b.dataset.table);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${b.dataset.table}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      say('');
    } catch (err) {
      fail(err);
    } finally {
      b.disabled = false;
    }
  });
}

if (admin.hasToken()) unlocked();
else locked();
