import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyPublication, publicationCalendarDate, publicationDateOf, selectRecentArticles } from '../shared/freshness.mjs';

const asOfISO = '2026-10-28T12:00:00Z';

test('seven-day window includes today and six prior dates only, sorted newest first', () => {
  const articles = [
    { id: 'before', publishedDate: '2026-10-21' },
    { id: 'first', publishedDate: '2026-10-22' },
    { id: 'yesterday', publishedDate: '2026-10-27' },
    { id: 'today', publishedDate: '2026-10-28' },
    { id: 'future', publishedDate: '2026-10-29' },
  ];
  const original = structuredClone(articles);
  const { items, stats } = selectRecentArticles(articles, { asOfISO, days: 7 });
  assert.deepEqual(items.map((item) => item.id), ['today', 'yesterday', 'first']);
  assert.deepEqual(stats, { total: 5, recent: 3, older: 1, future: 1, unknown: 0, demo: 0 });
  assert.equal(items[0], articles[3]);
  assert.deepEqual(articles, original);
});

test('Seoul midnight advances the publication window without a UTC-day slip', () => {
  assert.equal(publicationCalendarDate('2026-10-27T14:59:59Z'), '2026-10-27');
  assert.equal(publicationCalendarDate('2026-10-27T15:00:00Z'), '2026-10-28');
  assert.equal(publicationCalendarDate('2026-10-28T00:00:00+09:00'), '2026-10-28');
  assert.deepEqual(classifyPublication('2026-10-28', '2026-10-27T14:59:59Z'), { status: 'future', ageDays: -1 });
  assert.deepEqual(classifyPublication('2026-10-28', '2026-10-27T15:00:00Z'), { status: 'recent', ageDays: 0 });
  assert.deepEqual(classifyPublication('2026-10-28', '2026-10-27T15:00:00Z', false), { status: 'future', ageDays: -1 });
  const articles = [{ id: 'edge', date: '2026-10-21' }, { id: 'today', date: '2026-10-28' }];
  assert.deepEqual(selectRecentArticles(articles, { asOfISO: '2026-10-27T15:00:00Z', days: 7 }).items.map((item) => item.id), ['today']);
});

test('publication timestamps themselves use Seoul calendar dates', () => {
  assert.deepEqual(classifyPublication('2026-10-27T23:30:00Z', '2026-10-28'), { status: 'recent', ageDays: 0 });
  assert.deepEqual(classifyPublication('2026-10-28T15:00:00Z', '2026-10-28'), { status: 'future', ageDays: -1 });
  assert.deepEqual(classifyPublication('2026-10-28T15:00:00Z', '2026-10-28', false), { status: 'recent', ageDays: 0 });
});

test('invalid calendar dates and ambiguous timestamps are unknown, not normalized', () => {
  for (const value of [null, undefined, '', '2026-02-29', '2026-02-30', '2026-04-31', '2026-13-01', '2026-00-01', '2026-10-00', '2026-1-02', 'not a date', 20261028, '2026-10-28T00:00:00', '2026-02-30T12:00:00Z', '2026-10-28T24:00:00Z', '2026-10-28T00:60:00Z']) {
    assert.deepEqual(classifyPublication(value, asOfISO), { status: 'unknown', ageDays: null }, String(value));
  }
  assert.deepEqual(classifyPublication('2024-02-29', '2024-03-01'), { status: 'recent', ageDays: 1 });
  assert.deepEqual(classifyPublication('2000-02-29', '2000-03-01'), { status: 'recent', ageDays: 1 });
  assert.deepEqual(classifyPublication('1900-02-29', asOfISO), { status: 'unknown', ageDays: null });
});

test('unknown publication date never becomes fresh because it was retrieved today', () => {
  const articles = [
    { id: 'explicit-null', publishedDate: null, date: '2026-10-28', retrievedAt: asOfISO },
    { id: 'explicit-undefined', publishedDate: undefined, date: '2026-10-28', retrievedAt: asOfISO },
    { id: 'retrieved-only', retrievedAt: asOfISO },
    { id: 'old', publishedDate: '2024-01-01', retrievedAt: asOfISO },
    { id: 'legacy', date: '2026-10-28' },
  ];
  const { items, stats } = selectRecentArticles(articles, { asOfISO, days: 30 });
  assert.deepEqual(items.map((item) => item.id), ['legacy']);
  assert.deepEqual(stats, { total: 5, recent: 1, older: 1, future: 0, unknown: 3, demo: 0 });
  assert.equal(publicationDateOf(articles[0]), null);
  assert.equal(publicationDateOf(articles[1]), undefined);
});

test('demo, future, old and unknown material cannot fill an empty current-news window', () => {
  const articles = [
    { id: 'demo', date: '2026-10-28', isDemo: true },
    { id: 'demo-no-date', isDemo: true },
    { id: 'future', date: '2026-10-29' },
    { id: 'historic', date: '2023-10-28' },
    { id: 'unknown', publishedDate: null },
  ];
  const { items, stats } = selectRecentArticles(articles, { asOfISO, days: 90 });
  assert.deepEqual(items, []);
  assert.deepEqual(stats, { total: 5, recent: 0, older: 1, future: 1, unknown: 1, demo: 2 });
  assert.equal(stats.total, stats.recent + stats.older + stats.future + stats.unknown + stats.demo);
});

test('30/90-day cutoffs are inclusive and account for month boundaries', () => {
  const articles = [
    { id: 'thirty-first', date: '2026-09-28' },
    { id: 'thirtieth', date: '2026-09-29' },
    { id: 'ninety-first', date: '2026-07-30' },
    { id: 'ninetieth', date: '2026-07-31' },
  ];
  assert.deepEqual(selectRecentArticles(articles, { asOfISO, days: 30 }).items.map((item) => item.id), ['thirtieth']);
  assert.deepEqual(selectRecentArticles(articles, { asOfISO, days: 90 }).items.map((item) => item.id), ['thirtieth', 'thirty-first', 'ninetieth']);
  assert.deepEqual(classifyPublication('2026-09-29', asOfISO), { status: 'recent', ageDays: 29 });
  assert.deepEqual(classifyPublication('2026-09-28', asOfISO), { status: 'older', ageDays: 30 });
});

test('company filtering precedes stats and equal dates retain input order', () => {
  const articles = [
    { id: 'kci', date: '2026-10-28', companyId: 'kci' },
    { id: 'nc-a', date: '2026-10-28', companyId: 'ncchem' },
    { id: 'nc-b', date: '2026-10-28', companyId: 'ncchem' },
    { id: 'nc-demo', date: '2026-10-28', companyId: 'ncchem', isDemo: true },
  ];
  const { items, stats } = selectRecentArticles(articles, { asOfISO, days: 7, companyId: 'ncchem' });
  assert.deepEqual(items.map((item) => item.id), ['nc-a', 'nc-b']);
  assert.deepEqual(stats, { total: 3, recent: 2, older: 0, future: 0, unknown: 0, demo: 1 });
});

test('invalid reference or options fail explicitly instead of producing misleading freshness', () => {
  assert.throws(() => classifyPublication('2026-10-28', '2026-02-30'), RangeError);
  assert.throws(() => selectRecentArticles([], { asOfISO, days: 14 }), RangeError);
  assert.throws(() => selectRecentArticles([], { asOfISO, days: 7, companyId: 'other' }), RangeError);
  assert.throws(() => selectRecentArticles(null, { asOfISO, days: 7 }), TypeError);
});
