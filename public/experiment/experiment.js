// /experiment/: check in, pick actions, get a code; come back with the code to check out.
import { api } from '/js/site.js';
import {
  ACTIONS, MEASURES, actionLabel, resolveCode, normalizeCode, formatCode, emptyForm, rate, ratingsDone,
  toggleAction, canSubmit, startBody, finishBody, chooseView, personalModel, readyText, oneAtATime,
} from './model.js';
import { barHeight, changeText } from '../results/model.js';

const CODE_KEY = 'reachout.code';
const $ = (id) => document.getElementById(id);

// localStorage can throw (private mode, blocked storage); the page still works without it.
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* not remembered; the screenshot note covers it */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* nothing stored to forget */ } },
};

const HEADS = {
  loading: ['', 'The 24-hour experiment', ''],
  checkin: ['Step 1 of 3', 'Check in before your 24 hours', 'Anonymous. No name, no account. 1 is lowest, 5 is highest.'],
  pick: ['Step 2 of 3', 'Pick two or three', 'Choose what you will do on purpose in the next 24 hours.'],
  waiting: ['Step 3 of 3', 'You are in', 'Now connect on purpose. Come back with your code to check out.'],
  checkout: ['Check out', 'How do you feel now, after your 24 hours?', 'The same three questions. 1 is lowest, 5 is highest.'],
  mine: ['Thank you', 'Your before and after', 'Your answers are now part of the group results.'],
  done: ['', 'You have already checked out.', 'Thank you.'],
  'not-found': ['', 'We could not find that code.', 'Check it and try again.'],
  expired: ['', 'This code is more than 7 days old.', 'You can start the experiment again with a new code.'],
  error: ['', 'Something went wrong', ''],
};

let form = emptyForm();
let post = {};
let code = null;
let codeFromStorage = false;
let status = null;
// Shared by start and finish, so a double tap never sends a second POST.
const inFlight = oneAtATime();

function show(view, message = '') {
  for (const s of document.querySelectorAll('.exp-view')) s.hidden = s.id !== `view-${view}`;
  const [step, title, lede] = HEADS[view];
  $('step').textContent = step;
  $('title').textContent = title;
  $('lede').textContent = lede;
  $('alert').textContent = message;
  const codeForm = $('code-form');
  codeForm.hidden = view !== 'not-found';
  if (view === 'not-found') $('view-not-found').append(codeForm);
  $('forget-missing-row').hidden = !(view === 'not-found' && codeFromStorage);
  $('have-code').setAttribute('aria-expanded', 'false');
  if (view !== 'loading') $('title').focus({ preventScroll: true });
}

function buildRatings(container, onPick) {
  for (const [key, , question] of MEASURES) {
    const fs = document.createElement('fieldset');
    fs.className = 'rating';
    const legend = document.createElement('legend');
    legend.textContent = question;
    const scale = document.createElement('div');
    scale.className = 'scale';
    for (let v = 1; v <= 5; v++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = String(v);
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        for (const other of scale.children) other.setAttribute('aria-pressed', String(other === b));
        onPick(key, v);
      });
      scale.append(b);
    }
    fs.append(legend, scale);
    container.append(fs);
  }
}

function choiceRow(id, checked, onChange) {
  const row = document.createElement('label');
  row.className = 'choice';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.value = id;
  box.checked = checked;
  box.addEventListener('change', () => onChange(box));
  const text = document.createElement('span');
  text.textContent = actionLabel(id);
  row.append(box, text);
  return row;
}

function syncChoices() {
  for (const box of $('action-list').querySelectorAll('input')) {
    box.checked = form.actions.includes(box.value);
    box.disabled = !box.checked && form.actions.length >= 3;
  }
  $('pick-count').textContent = `${form.actions.length} of 3 chosen`;
  $('pick-submit').disabled = !canSubmit(form) || inFlight.busy();
}

function setUrlCode(c) {
  const url = new URL(location.href);
  if (c) url.searchParams.set('code', c);
  else url.searchParams.delete('code');
  history.replaceState(null, '', url);
}

const ticksKey = () => `reachout.ticks.${code}`;

function showWaiting() {
  $('code-text').textContent = formatCode(code);
  $('ready-text').textContent = `Come back after ${readyText(status.ready_at)} to check out.`;
  let ticks = [];
  try { ticks = JSON.parse(store.get(ticksKey()) || '[]'); } catch { ticks = []; }
  $('tick-list').replaceChildren(...status.actions.map((id) => choiceRow(id, ticks.includes(id), (box) => {
    ticks = box.checked ? [...new Set([...ticks, id])] : ticks.filter((t) => t !== id);
    store.set(ticksKey(), JSON.stringify(ticks));
  })));
  $('start-over-confirm').hidden = true;
  show('waiting');
}

function showMine(result) {
  const items = personalModel(result).map((m) => {
    const item = document.createElement('div');
    item.className = 'pair';
    const head = document.createElement('h2');
    head.className = 'pair-title';
    head.textContent = m.label;
    item.append(head);
    for (const [cls, label, value] of [['before', 'Before', m.before], ['after', 'After', m.after]]) {
      const row = document.createElement('div');
      row.className = 'pair-row';
      const name = document.createElement('span');
      name.className = 'pair-name';
      name.textContent = label;
      const track = document.createElement('span');
      track.className = 'pair-track';
      const bar = document.createElement('span');
      bar.className = `pair-bar pair-${cls}`;
      bar.style.width = `${barHeight(value)}%`;
      track.append(bar);
      const num = document.createElement('span');
      num.className = 'pair-num';
      num.textContent = String(value);
      row.append(name, track, num);
      item.append(row);
    }
    const change = document.createElement('p');
    change.className = 'muted small';
    change.textContent = `${m.before} to ${m.after}, ${changeText(m.before, m.after).replace(/\.00$/, '')}.`;
    item.append(change);
    return item;
  });
  $('pairs').replaceChildren(...items);
  show('mine');
}

async function lookUp() {
  show('loading');
  try {
    status = await api(`/api/experiment/${encodeURIComponent(code)}`);
  } catch (err) {
    status = null;
    const view = chooseView(err);
    if (view === 'done') store.del(CODE_KEY);
    show(view, view === 'error' ? err.message : '');
    return;
  }
  const view = chooseView(status);
  if (view === 'done') {
    store.del(CODE_KEY);
    show('done');
  } else {
    store.set(CODE_KEY, code);
    if (view === 'waiting') showWaiting();
    else show(view);
  }
}

function startFresh() {
  store.del(CODE_KEY);
  code = null;
  status = null;
  form = emptyForm();
  for (const b of $('pre-ratings').querySelectorAll('button')) b.setAttribute('aria-pressed', 'false');
  $('checkin-next').disabled = true;
  syncChoices();
  setUrlCode(null);
  show('checkin');
}

function init() {
  buildRatings($('pre-ratings'), (k, v) => {
    form = rate(form, k, v);
    $('checkin-next').disabled = !ratingsDone(form.ratings);
  });
  buildRatings($('post-ratings'), (k, v) => {
    post = { ...post, [k]: v };
    $('checkout-submit').disabled = !ratingsDone(post) || inFlight.busy();
  });
  $('action-list').append(...ACTIONS.map(([id]) => choiceRow(id, false, () => {
    form = toggleAction(form, id);
    syncChoices();
  })));

  $('checkin-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!ratingsDone(form.ratings)) return;
    syncChoices();
    show('pick');
  });
  $('pick-back').addEventListener('click', () => show('checkin'));

  $('pick-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!canSubmit(form) || inFlight.busy()) return;
    $('pick-submit').disabled = true;
    await inFlight(async () => {
      try {
        const res = await api('/api/experiment/start', { method: 'POST', body: startBody(form) });
        code = res.code;
        codeFromStorage = false;
        status = { status: 'waiting', ready_at: res.ready_at, actions: [...form.actions] };
        store.set(CODE_KEY, code);
        setUrlCode(null);
        showWaiting();
      } catch (err) {
        $('alert').textContent = err.message;
      }
    });
    syncChoices();
  });

  $('checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!ratingsDone(post) || inFlight.busy()) return;
    $('checkout-submit').disabled = true;
    await inFlight(async () => {
      try {
        const res = await api(`/api/experiment/${encodeURIComponent(code)}/finish`, { method: 'POST', body: finishBody(post) });
        store.del(CODE_KEY);
        store.del(ticksKey());
        showMine(res);
      } catch (err) {
        if (err.status === 409 && err.code === 'too_early') showWaiting();
        else if (chooseView(err) === 'error') $('alert').textContent = err.message;
        else show(chooseView(err));
      }
    });
    $('checkout-submit').disabled = !ratingsDone(post);
  });

  $('have-code').addEventListener('click', () => {
    const f = $('code-form');
    if (f.parentElement !== $('view-checkin')) $('view-checkin').append(f);
    f.hidden = !f.hidden;
    $('have-code').setAttribute('aria-expanded', String(!f.hidden));
    if (!f.hidden) $('code-input').focus();
  });

  $('code-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const typed = normalizeCode($('code-input').value);
    if (!typed) {
      $('alert').textContent = 'Type the six-character code you were given.';
      return;
    }
    code = typed;
    codeFromStorage = false;
    setUrlCode(code);
    lookUp();
  });

  $('start-over').addEventListener('click', () => {
    $('start-over-confirm').hidden = false;
    $('forget-no').focus();
  });
  $('forget-no').addEventListener('click', () => {
    $('start-over-confirm').hidden = true;
    $('start-over').focus();
  });
  $('forget-yes').addEventListener('click', () => {
    store.del(ticksKey());
    startFresh();
  });
  $('start-again').addEventListener('click', startFresh);
  $('forget-missing').addEventListener('click', startFresh);
  $('retry').addEventListener('click', lookUp);

  code = resolveCode(location.search, store.get(CODE_KEY));
  codeFromStorage = Boolean(code) && !normalizeCode(new URLSearchParams(location.search).get('code'));
  if (code) lookUp();
  else show('checkin');
}

init();
