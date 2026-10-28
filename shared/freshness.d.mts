export type PublicationStatus = 'recent' | 'older' | 'future' | 'unknown';
export type PublicationClassification = { status: PublicationStatus; ageDays: number | null };
export type FreshnessDays = 7 | 30 | 90;
export type FreshnessCompany = 'all' | 'ncchem' | 'kci' | 'verdant';
export type PublicationRecord = {
  publishedDate?: unknown;
  date?: unknown;
  retrievedAt?: unknown;
  companyId?: unknown;
  isDemo?: unknown;
};
export type FreshnessStats = {
  /** Company-matching inputs; the five classes below are mutually exclusive. */
  total: number;
  recent: number;
  older: number;
  future: number;
  unknown: number;
  demo: number;
};
/** Date-only values stay explicit dates; zoned instants use Seoul unless false selects UTC. */
export function publicationCalendarDate(value: unknown, seoulTimezone?: boolean): string | null;
/** Defaults to a 30-calendar-day recent window; invalid asOfISO throws RangeError. */
export function classifyPublication(date: unknown, asOfISO: string, seoulTimezone?: boolean): PublicationClassification;
/** An explicitly null or undefined publishedDate is unknown, even if date/retrievedAt exists. */
export function publicationDateOf(article: unknown): unknown;
export function selectRecentArticles<T extends PublicationRecord>(
  articles: readonly T[],
  options: { asOfISO: string; days: FreshnessDays; companyId?: FreshnessCompany },
): { items: T[]; stats: FreshnessStats };
