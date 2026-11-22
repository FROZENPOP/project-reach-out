// Pure logic for /fact/.
export { pickOther } from './shared.js';

// "Tomova et al., 2020", "Blakemore & Mills, 2014", "Office of the Surgeon General, 2023" from an APA reference.
export function shortCitation(apa) {
  const m = apa.match(/^(.*?)\.?\s*\((\d{4})\)/);
  if (!m) return apa;
  const [, authors, year] = m;
  const surnames = [...authors.matchAll(/([^,&]+),\s*((?:[A-Z]\.(?:-[A-Z]\.)?\s*)+)/g)].map((a) => a[1].trim());
  let who;
  if (surnames.length === 0) who = authors.trim(); // a group author
  else if (surnames.length === 1) who = surnames[0];
  else if (surnames.length === 2) who = `${surnames[0]} & ${surnames[1]}`;
  else who = `${surnames[0]} et al.`;
  return `${who}, ${year}`;
}
