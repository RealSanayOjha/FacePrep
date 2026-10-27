/** Small formatting and parsing helpers used by routes and EJS views. */

/** 17 Sep 2026 */
function formatDate(value) {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Short month label for event calendar badges -> "OCT" */
function formatMonthShort(value) {
  if (!value) return 'TBD';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return 'TBD';
  return d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
}

/** Two-digit day number for event calendar badges -> "27" */
function formatDayNum(value) {
  if (!value) return '--';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '--';
  return String(d.getDate()).padStart(2, '0');
}

/** Human-friendly relative label ("Today", "In 4 days", "3 days ago") */
function formatRelativeDate(value) {
  if (!value) return 'Date TBD';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return 'Date TBD';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfTarget - startOfToday) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1 && diffDays <= 30) return `In ${diffDays} days`;
  if (diffDays < -1 && diffDays >= -30) return `${Math.abs(diffDays)} days ago`;
  return formatDate(d);
}

/** 2026-09-17 -> the format <input type="date"> expects */
function toDateInput(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/** Two-letter initials for member avatars ("Sanay Ojha" -> "SO") */
function initials(name) {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Escape regex special characters so queries like "C++" or "Node.js" work safely in $regex */
function escapeRegex(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Parse comma-separated input into a clean deduplicated array of strings */
function parseCsvList(input, { lower = false } = {}) {
  if (!input) return [];
  const raw = Array.isArray(input) ? input.join(',') : String(input);
  const seen = new Set();
  const out = [];
  for (const item of raw.split(',')) {
    const cleaned = (lower ? item.trim().toLowerCase() : item.trim()).replace(/^#/, '');
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(cleaned);
    }
  }
  return out;
}

module.exports = {
  formatDate,
  formatMonthShort,
  formatDayNum,
  formatRelativeDate,
  toDateInput,
  initials,
  escapeRegex,
  parseCsvList,
};
