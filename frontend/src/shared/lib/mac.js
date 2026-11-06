// One optional EUI-48 address for a device interface; this is input validation,
// not discovery, identification, or a claim that a device is reachable.
export function normalizeMac(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const validShape =
    /^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(text) ||
    /^(?:[0-9a-f]{2}-){5}[0-9a-f]{2}$/i.test(text) ||
    /^(?:[0-9a-f]{4}\.){2}[0-9a-f]{4}$/i.test(text) ||
    /^[0-9a-f]{12}$/i.test(text);
  if (!validShape) return null;
  const hex = text.replace(/[:.\-]/g, '').toUpperCase();
  // A primary-interface address must be non-zero and unicast; locally
  // administered and randomized unicast addresses are accepted.
  if (hex === '000000000000' || (parseInt(hex.slice(0, 2), 16) & 1) !== 0) return null;
  return hex.match(/.{2}/g).join(':');
}

// Permit full or partial MAC queries using any common separator.
export function matchesMac(value, query) {
  const needle = String(query ?? '').trim();
  if (!/^[0-9a-f:.\-\s]+$/i.test(needle)) return false;
  const compact = needle.replace(/[:.\-\s]/g, '').toLowerCase();
  if (compact.length < 4 || compact.length > 12) return false;
  return String(value ?? '')
    .replace(/[:.\-\s]/g, '')
    .toLowerCase()
    .includes(compact);
}
