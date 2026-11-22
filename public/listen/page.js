import { api } from '/js/site.js';
import { podcastView } from '/listen/logic.js';

const $ = (id) => document.getElementById(id);

try {
  const site = await api('/data/site.json');
  const view = podcastView(site.podcast);
  if (view.kind === 'soon') {
    $('listen-status').textContent = 'The clip is coming soon. Check back in a few days.';
  } else {
    $('listen-status').hidden = true;
    $('listen-title').textContent = view.title;
    $('listen-title').hidden = false;
    if (view.summary) {
      $('listen-summary').textContent = view.summary;
      $('listen-summary').hidden = false;
    }
    if (view.kind === 'embed') {
      const frame = document.createElement('iframe');
      frame.src = view.src;
      frame.title = view.title;
      frame.loading = 'lazy';
      frame.allow = 'encrypted-media; picture-in-picture';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      $('listen-player').append(frame);
      $('listen-player').hidden = false;
    } else {
      $('listen-link').href = view.href;
      $('listen-link').hidden = false;
    }
    // Quiet ping: a counter must never interrupt a visitor, so a failure is ignored.
    api('/api/count', { method: 'POST', body: { name: 'listen_opened' } }).catch(() => {});
  }
} catch (err) {
  $('listen-status').hidden = true;
  $('listen-error').textContent = `Could not load the clip. ${err.message}`;
}
