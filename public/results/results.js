// /results/: live before and after chart, pulse totals, campaign counts and approved answers.
import { api } from '/js/site.js';
import { loadResults } from './model.js';

const $ = (id) => document.getElementById(id);

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

const bar = (cls, pct) => {
  const b = el('span', `bar ${cls}`);
  b.style.height = `${pct}%`;
  return b;
};

const row = (cells) => {
  const tr = el('tr');
  cells.forEach((c, i) => tr.append(el(i === 0 ? 'th' : 'td', '', String(c))));
  tr.firstChild.setAttribute('scope', 'row');
  return tr;
};

const rankItem = (label, count) => {
  const li = el('li');
  li.append(el('span', '', label), el('span', 'rank-count', String(count)));
  return li;
};

// Empties every element that can hold a number, so an error never leaves old ones behind.
function clear() {
  for (const id of ['chart', 'chart-rows', 'actions-list', 'pulse-bars', 'pulse-rows', 'scan-list', 'answers']) $(id).replaceChildren();
  for (const id of ['pulse-text', 'chart-waiting', 'pulse-waiting', 'answers-empty', 'stat-scans', 'stat-challenges', 'stat-games', 'stat-clips']) $(id).textContent = '';
}

function renderChart(exp) {
  $('chart').hidden = !exp.chart;
  $('chart-table').hidden = !exp.chart;
  $('chart-legend').hidden = !exp.chart;
  $('chart-waiting').hidden = Boolean(exp.chart);
  if (!exp.chart) {
    $('chart-waiting').textContent = exp.waiting;
    return;
  }
  const axis = el('div', 'axis');
  for (let v = 5; v >= 1; v--) axis.append(el('span', '', String(v)));
  $('chart').append(axis);
  for (const g of exp.chart) {
    const group = el('div', 'group');
    const bars = el('div', 'bars');
    bars.append(bar('bar-before', g.beforePct), bar('bar-after', g.afterPct));
    group.append(bars, el('span', 'group-label', g.label), el('span', 'group-text', g.text));
    if (g.note) group.append(el('span', 'group-note', g.note));
    $('chart').append(group);
    $('chart-rows').append(row([g.label, g.before.toFixed(2), g.after.toFixed(2), g.change]));
  }
}

function render(m) {
  clear();
  $('headline').textContent = m.experiment.headline;
  renderChart(m.experiment);

  $('actions-section').hidden = !m.experiment.actions;
  for (const a of m.experiment.actions ?? []) $('actions-list').append(rankItem(a.label, a.count));

  $('pulse-text').textContent = m.pulse.text;
  $('pulse-waiting').hidden = Boolean(m.pulse.bars);
  $('pulse-table').hidden = !m.pulse.bars;
  if (m.pulse.bars) {
    for (const b of m.pulse.bars) {
      const col = el('div', 'mini-col');
      const track = el('div', 'mini-track');
      track.append(bar('bar-after', b.pct));
      col.append(el('span', 'mini-count', String(b.count)), track, el('span', 'mini-label', String(b.total)));
      $('pulse-bars').append(col);
      $('pulse-rows').append(row([b.total, b.count]));
    }
  } else {
    $('pulse-waiting').textContent = m.pulse.waiting;
  }

  const c = m.campaign;
  $('stat-scans').textContent = String(c.totalScans);
  $('stat-challenges').textContent = String(c.challenges);
  $('stat-games').textContent = String(c.games);
  $('stat-clips').textContent = String(c.clips);
  for (const s of c.scans) $('scan-list').append(rankItem(`${s.n}. ${s.title}`, s.count));

  $('answers-empty').hidden = !m.answers.empty;
  if (m.answers.empty) $('answers-empty').textContent = m.answers.text;
  else $('answers').append(...m.answers.items.map((t) => el('p', 'card answer', t)));
}

async function load() {
  $('retry').disabled = true;
  const m = await loadResults(api);
  $('retry').disabled = false;
  if (m.state === 'error') {
    clear();
    $('content').hidden = true;
    $('headline').textContent = 'The results could not load.';
    $('alert').textContent = m.message;
    $('error').hidden = false;
    return;
  }
  $('error').hidden = true;
  $('alert').textContent = '';
  render(m);
  $('content').hidden = false;
}

$('retry').addEventListener('click', load);
load();
