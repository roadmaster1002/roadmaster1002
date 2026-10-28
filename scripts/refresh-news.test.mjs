import test from 'node:test';
import assert from 'node:assert/strict';
import { QUERIES, FeedError, publicUrl, parseRss, deduplicate, refreshSnapshot, fetchFeedXml, parseArgs } from './refresh-news.mjs';

const NOW = new Date('2026-10-28T09:00:00Z');
const item = ({ title = 'Photoresist &amp; EUV materials - Source News', link = 'https://news.google.com/rss/articles/ABC?oc=5', date = 'Wed, 28 Oct 2026 00:00:00 GMT', source = 'Source News', sourceUrl = 'http://publisher.example.com/', description = '&lt;p&gt;Photoresist &amp;amp; EUV development.&lt;/p&gt;' } = {}) => `<item><title>${title}</title><link>${link}</link><pubDate>${date}</pubDate><source url="${sourceUrl}">${source}</source><description>${description}</description></item>`;
const rss = (...items) => `<rss version="2.0"><channel><title>Test search feed</title>${items.join('')}</channel></rss>`;
const news = (id, companyIds, publishedAtISO = '2026-10-27T00:00:00.000Z') => ({ id, title: `Photoresist materials ${id}`, sourceName: 'Source News', sourceUrl: `https://news.google.com/articles/${id}`, date: '2026-10-27', publishedAtISO, companyIds, summary: 'RSS metadata only', verification: 'feed-metadata' });

test('RSS entities, CDATA, publisher HTTP origin and publication date preserve metadata-only provenance', () => {
  const result = parseRss(rss(item({ title: '<![CDATA[Photoresist & EUV materials - Source News]]>' })), 'ncchem', NOW)[0];
  assert.equal(result.title, 'Photoresist & EUV materials');
  assert.equal(result.publisherUrl, 'http://publisher.example.com');
  assert.equal(result.sourceUrl, 'https://news.google.com/rss/articles/ABC');
  assert.equal(result.date, '2026-10-28');
  assert.equal(result.verification, 'feed-metadata');
  assert.match(result.summary, /기사 본문 미확인/);
  assert.match(result.summary, /Photoresist & EUV/);
});

test('publication window excludes unknown, future and older-than89days items without inventing a current date', () => {
  const data = rss(item({ date: '' }), item({ date: 'not a date' }), item({ date: 'Wed, 31 Sep 2026 00:00:00 GMT' }), item({ date: '2026-09-31T00:00:00Z' }), item({ date: '2026-10-27 09:00:00' }), item({ date: 'Thu, 29 Oct 2026 00:00:00 GMT' }), item({ date: 'Thu, 30 Jul 2026 00:00:00 GMT' }), item({ date: 'Sat, 01 Aug 2026 00:00:00 GMT', link: 'https://news.google.com/articles/boundary' }));
  const results = parseRss(data, 'ncchem', NOW);
  assert.equal(results.length, 1);
  assert.equal(results[0].date, '2026-08-01');
  const seoulDate = parseRss(rss(item({ date: 'Tue, 27 Oct 2026 18:00:00 GMT' })), 'ncchem', NOW)[0];
  assert.equal(seoulDate.date, '2026-10-28');
});

test('nonarticles, unsafe publishers and obvious market-report spam are excluded or sanitized', () => {
  const items = parseRss(rss(item({ title: 'Photoresist market size CAGR 2026-2035 - Source News' }), item({ title: 'Football championship results - Source News' }), item({ link: 'https://news.google.com/search?q=photoresist' }), item({ link: 'javascript:alert(1)' }), item({ sourceUrl: 'https://user:secret@publisher.example.com/', link: 'https://news.google.com/articles/safe' })), 'ncchem', NOW);
  assert.equal(items.length, 1);
  assert.equal(items[0].publisherUrl, undefined);
  for (const url of ['https://localhost/a', 'http://127.0.0.1/a', 'https://user:secret@example.com/a', 'https://example.com/feed.xml', 'https://news.google.com/rss/search?q=x']) assert.equal(publicUrl(url, true), null);
  assert.equal(publicUrl('http://example.com/news/article', true).href, 'http://example.com/news/article');
});

test('each query matches its company market and duplicates merge company associations', () => {
  assert.equal(QUERIES.length, 3);
  for (const { url } of QUERIES) assert.match(new URL(url).searchParams.get('q'), /when:90d/);
  assert.equal(parseRss(rss(item({ title: 'Polyquaternium hair care ingredients - Source News' })), 'kci', NOW).length, 1);
  assert.equal(parseRss(rss(item({ title: 'Nouryon biosurfactant plant - Source News' })), 'verdant', NOW).length, 1);
  const duplicate = deduplicate([news('same', ['kci']), { ...news('same', ['verdant']), sourceUrl: 'https://news.google.com/articles/same?utm_source=test' }]);
  assert.equal(duplicate.length, 1);
  assert.deepEqual(duplicate[0].companyIds, ['kci', 'verdant']);
});

test('invalid XML, external entities, feed errors and redirects never get treated as articles', async () => {
  for (const xml of ['<html>403 Access denied</html>', '<!DOCTYPE rss [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><rss><channel></channel></rss>']) assert.throws(() => parseRss(xml, 'kci', NOW), FeedError);
  await assert.rejects(() => fetchFeedXml(QUERIES[0].url, { fetchFn: async () => new Response('do not expose credential=secret', { status: 403 }) }), /HTTP 403/);
  await assert.rejects(() => fetchFeedXml(QUERIES[0].url, { fetchFn: async () => new Response(null, { status: 302, headers: { location: 'https://localhost/private' } }) }), /HTTP 302/);
  await assert.rejects(() => fetchFeedXml('https://example.com/rss'), FeedError);
});

test('total failure preserves previous items and successful timestamps but advances attempt timestamp', async () => {
  const previous = { updatedAtISO: '2026-10-27T00:00:00Z', lastSuccessfulAtISO: '2026-10-27T00:00:00Z', items: [news('old', ['ncchem'])] };
  const result = await refreshSnapshot({ previous, now: NOW, readFeed: async () => { throw new Error('secret must not appear'); } });
  assert.equal(result.status, 'error');
  assert.equal(result.attemptedAtISO, NOW.toISOString());
  assert.equal(result.updatedAtISO, previous.updatedAtISO);
  assert.equal(result.lastSuccessfulAtISO, previous.lastSuccessfulAtISO);
  assert.deepEqual(result.items, previous.items);
  assert.equal(result.sources.length, 3);
  assert.doesNotMatch(JSON.stringify(result.errors), /secret/);
});

test('partial failure retains only nonexpired items for failed sources', async () => {
  const previous = { lastSuccessfulAtISO: '2026-10-27T00:00:00Z', items: [news('keep', ['kci', 'ncchem']), news('expired', ['kci'], '2026-01-01T00:00:00Z'), news('replace', ['verdant'])] };
  const result = await refreshSnapshot({ previous, now: NOW, readFeed: async (url) => { if (url === QUERIES[1].url) throw new FeedError('RSS unavailable'); return rss(item({ title: url === QUERIES[0].url ? 'Photoresist innovation - Source News' : 'Nouryon surfactant development - Source News', link: `https://news.google.com/articles/${url === QUERIES[0].url ? 'new-nc' : 'new-v'}` })); } });
  assert.equal(result.status, 'partial');
  assert.equal(result.updatedAtISO, NOW.toISOString());
  assert.equal(result.lastSuccessfulAtISO, previous.lastSuccessfulAtISO);
  assert.deepEqual(result.items.find((entry) => entry.id === 'keep').companyIds, ['kci']);
  assert.ok(!result.items.some((entry) => ['expired', 'replace'].includes(entry.id)));
});

test('ready snapshots cap60 total,30percompany and sort newest first', async () => {
  const titles = { ncchem: 'Photoresist EUV', kci: 'Polyquaternium hair care ingredients', verdant: 'Nouryon surfactant' };
  const result = await refreshSnapshot({ now: NOW, readFeed: async (url) => { const company = QUERIES.find((source) => source.url === url).companyId; return rss(...Array.from({ length: 35 }, (_, i) => item({ title: `${titles[company]} item ${i} - Source News`, link: `https://news.google.com/articles/${company}-${i}`, date: new Date(NOW.valueOf() - i * 3600000).toUTCString() }))); } });
  assert.equal(result.status, 'ready');
  assert.equal(result.lastSuccessfulAtISO, NOW.toISOString());
  assert.equal(result.items.length, 60);
  for (const { companyId } of QUERIES) assert.ok(result.items.filter((entry) => entry.companyIds.includes(companyId)).length <= 30);
  assert.deepEqual(result.items.map((entry) => entry.publishedAtISO), result.items.map((entry) => entry.publishedAtISO).sort().reverse());
});

test('CLI supports offline help/default path and rejects unexpected flags', () => {
  assert.deepEqual(parseArgs([]), { out: 'public/latest-news.json' });
  assert.deepEqual(parseArgs(['--help']), { help: true });
  assert.deepEqual(parseArgs(['--out', '/tmp/snapshot.json']), { out: '/tmp/snapshot.json' });
  assert.throws(() => parseArgs(['--live', 'yes']), FeedError);
});
