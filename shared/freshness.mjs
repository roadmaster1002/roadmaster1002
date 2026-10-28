/**
 * Publication freshness only. Collection time never changes a source's age.
 * Calendar-day windows include today and the preceding days - 1 dates in Seoul.
 * classifyPublication uses a 30-day window; selectRecentArticles uses its window.
 */
const DAY_MS = 86_400_000;
const ALLOWED_DAYS = new Set([7, 30, 90]);
const COMPANY_IDS = new Set(['all', 'ncchem', 'kci', 'verdant']);
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIMESTAMP_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/;

function validCalendarDate(value) {
  if (typeof value !== 'string') return false;
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const maxDay = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= maxDay;
}

function instantDate(value, seoulTimezone) {
  const match = TIMESTAMP_RE.exec(value);
  if (!match || !validCalendarDate(match[1])) return null;
  const [, , hours, minutes, seconds = '00', , zone] = match;
  if (Number(hours) > 23 || Number(minutes) > 59 || Number(seconds) > 59) return null;
  if (zone !== 'Z') {
    const [offsetHours, offsetMinutes] = zone.slice(1).split(':').map(Number);
    if (offsetHours > 23 || offsetMinutes > 59) return null;
  }
  const instant = Date.parse(value);
  if (!Number.isFinite(instant)) return null;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: seoulTimezone ? 'Asia/Seoul' : 'UTC',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date(instant));
  const part = (name) => parts.find((entry) => entry.type === name)?.value;
  const date = `${part('year')?.padStart(4, '0')}-${part('month')}-${part('day')}`;
  return validCalendarDate(date) ? date : null;
}

/** YYYY-MM-DD stays an explicit calendar date; zoned ISO instants use Seoul by default. */
export function publicationCalendarDate(value, seoulTimezone = true) {
  if (typeof value !== 'string') return null;
  if (validCalendarDate(value)) return value;
  return instantDate(value, seoulTimezone);
}

function referenceDay(asOfISO, seoulTimezone = true) {
  const date = publicationCalendarDate(asOfISO, seoulTimezone);
  if (!date) throw new RangeError('asOfISO must be a valid ISO date or a timezone-qualified ISO timestamp.');
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
}

function ageAt(date, today, seoulTimezone = true) {
  const publishedDate = publicationCalendarDate(date, seoulTimezone);
  return publishedDate === null ? null : today - Math.floor(Date.parse(`${publishedDate}T00:00:00Z`) / DAY_MS);
}

export function classifyPublication(date, asOfISO, seoulTimezone = true) {
  const ageDays = ageAt(date, referenceDay(asOfISO, seoulTimezone), seoulTimezone);
  if (ageDays === null) return { status: 'unknown', ageDays: null };
  if (ageDays < 0) return { status: 'future', ageDays };
  return { status: ageDays < 30 ? 'recent' : 'older', ageDays };
}

/** Explicitly unknown publishedDate never falls back to date or retrievedAt. */
export function publicationDateOf(article) {
  if (!article || typeof article !== 'object' || Array.isArray(article)) return undefined;
  return 'publishedDate' in article ? article.publishedDate : article.date;
}

export function selectRecentArticles(articles, { asOfISO, days, companyId = 'all' }) {
  if (!Array.isArray(articles)) throw new TypeError('articles must be an array.');
  if (!ALLOWED_DAYS.has(days)) throw new RangeError('days must be 7, 30, or 90.');
  if (!COMPANY_IDS.has(companyId)) throw new RangeError('companyId must be all, ncchem, kci, or verdant.');
  const today = referenceDay(asOfISO);
  const stats = { total: 0, recent: 0, older: 0, future: 0, unknown: 0, demo: 0 };
  const selected = [];
  articles.forEach((article, index) => {
    if (companyId !== 'all' && article?.companyId !== companyId) return;
    stats.total += 1;
    if (article?.isDemo === true) { stats.demo += 1; return; }
    const ageDays = ageAt(publicationDateOf(article), today);
    if (ageDays === null) { stats.unknown += 1; return; }
    if (ageDays < 0) { stats.future += 1; return; }
    if (ageDays >= days) { stats.older += 1; return; }
    stats.recent += 1;
    selected.push({ article, ageDays, index });
  });
  // Stable by input order on the same publication calendar day. Do not sort by retrieval time.
  selected.sort((a, b) => a.ageDays - b.ageDays || a.index - b.index);
  return { items: selected.map(({ article }) => article), stats };
}
