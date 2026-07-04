export function formatName(raw) {
  if (!raw) return '';
  const PARTICLES = new Set(['de','del','dela','delos','delas','dlos','di','da','du','van','von','der','den','la','le','los','las','y']);
  const ROMAN = new Set(['ii','iii','iv','v','vi','vii','viii','ix','x']);
  const SUFFIX = { 'jr':'Jr.', 'jr.':'Jr.', 'sr':'Sr.', 'sr.':'Sr.' };
  const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);
  const capApos = p => (p.includes("'") ? p.split("'").map(cap).join("'") : cap(p));
  const token = (t, first, last) => {
    const lower = t.toLowerCase();
    const bare = lower.replace(/\.$/, '');
    if (/^([a-z]\.)+$/i.test(t)) return t.toUpperCase();
    if (last && !first) {
      if (ROMAN.has(bare)) return t.toUpperCase();
      if (SUFFIX[lower]) return SUFFIX[lower];
    }
    if (!first && PARTICLES.has(bare)) return bare;
    if (t.includes('-')) return t.split('-').map(capApos).join('-');
    if (t.includes("'")) return t.split("'").map(cap).join("'");
    return cap(t);
  };
  const parts = raw.trim().replace(/\s+/g, ' ').split(' ');
  return parts.map((w, i) => token(w, i === 0, i === parts.length - 1)).join(' ');
}
