// Pure logic for /listen/.
export const EMBED_HOSTS = ['open.spotify.com', 'www.youtube-nocookie.com', 'embed.podcasts.apple.com'];

const httpsUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null; // empty or not a URL: treated as not provided
  }
};

// site.json's podcast -> { kind: 'embed', src } | { kind: 'link', href } | { kind: 'soon' }, plus title and summary.
export function podcastView(podcast) {
  const title = podcast?.title || 'Our podcast';
  const summary = podcast?.summary || '';
  const embed = httpsUrl(podcast?.embed_url);
  if (embed && EMBED_HOSTS.includes(embed.hostname) && !embed.port) return { kind: 'embed', src: embed.href, title, summary };
  const link = httpsUrl(podcast?.link_url);
  if (link) return { kind: 'link', href: link.href, title, summary };
  return { kind: 'soon', title, summary };
}
