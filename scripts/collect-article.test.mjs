import test from 'node:test';
import assert from 'node:assert/strict';
import { ALLOWED_HOSTS, CollectionError, validateUrl, parseArgs, publicationDate, extractArticle, collectArticle } from './collect-article.mjs';

const paragraph = 'The source article discusses semiconductor materials, customer qualification, manufacturing capacity and regulatory evidence. These statements are test fixtures, not current market news. ';
const body = `<article><h1>Materials industry development</h1><p>${paragraph.repeat(3)}</p><nav>UNRELATED NAVIGATION</nav><script>secretCode()</script></article>`;
const html = `<html><head><meta property="og:site_name" content="Publisher &amp; News"><meta property="article:published_time" content="2026-10-24T09:00:00Z"><meta property="og:title" content="Materials &amp; Innovation"></head><body>${body}</body></html>`;
const url = 'https://semiengineering.com/example-article/';

test('URL validation only accepts exact10 public HTTPS publisher hosts and strips fragment', () => {
  assert.equal(ALLOWED_HOSTS.size, 10);
  assert.equal(validateUrl(`${url}#section`).href, url);
  for (const value of ['http://semiengineering.com/a', 'https://semiengineering.com.evil.test/a', 'https://127.0.0.1/a', 'https://localhost/a', 'https://user:secret@semiengineering.com/a', 'https://semiengineering.com:8443/a', 'https://example.com/a']) assert.throws(() => validateUrl(value), CollectionError);
});

test('CLI flags require company,url,out and reject unknown/duplicate flags', () => {
  assert.deepEqual(parseArgs(['--help']), { help: true });
  assert.equal(parseArgs(['--url', url, '--company', 'ncchem', '--out', '/tmp/out.json']).companyId, 'ncchem');
  for (const args of [[], ['--url', url], ['--url', url, '--company', 'invalid', '--out', '/tmp/a'], ['--url', url, '--company', 'kci', '--out', '/tmp/a', '--insecure', 'true'], ['--url', url, '--url', url, '--company', 'kci', '--out', '/tmp/a']]) assert.throws(() => parseArgs(args), CollectionError);
});

test('HTML metadata and body extraction preserve source provenance without importing navigation/scripts', () => {
  const result = extractArticle(html, url, 'ncchem', '2026-10-28T00:00:00Z');
  assert.equal(result.schema, 'chem2.article.v1');
  assert.equal(result.title, 'Materials & Innovation');
  assert.equal(result.publisher, 'Publisher & News');
  assert.equal(result.publishedDate, '2026-10-24');
  assert.equal(result.retrievedAtISO, '2026-10-28T00:00:00Z');
  assert.equal(result.verification, 'source-read');
  assert.match(result.excerpt, /semiconductor materials/);
  assert.doesNotMatch(result.excerpt, /UNRELATED NAVIGATION|secretCode/);
  assert.match(result.contentHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.notes, { keyTakeaways: '', evidence: '', businessImpact: '', followUp: '' });
});

test('JSON-LD graph article metadata and articleBody are read as data', () => {
  const structured = { '@graph': [{ '@type': 'WebSite', name: 'ignore' }, { '@type': 'NewsArticle', headline: 'Structured article headline', datePublished: '2026-10-25', publisher: { name: 'Source publisher' }, articleBody: paragraph.repeat(4) }] };
  const result = extractArticle(`<html><head><script type="application/ld+json">${JSON.stringify(structured)}</script></head><body></body></html>`, url, 'verdant');
  assert.equal(result.title, 'Structured article headline');
  assert.equal(result.publishedDate, '2026-10-25');
  assert.equal(result.publisher, 'Source publisher');
});

test('unknown or invalid publication dates remain null and do not become retrieval date', () => {
  const result = extractArticle(`<html><head><title>Article without publication date</title><meta property="article:modified_time" content="2026-10-28"></head><body>${body}</body></html>`, url, 'kci', '2026-10-28T00:00:00Z');
  assert.equal(result.publishedDate, null);
  assert.equal(publicationDate('2026-02-30'), null);
  assert.equal(publicationDate('October 28, 2026'), null);
});

test('no body, short navigation shells and paywall pages are rejected', () => {
  for (const sample of ['<html><title>Navigation home</title><nav>menu</nav></html>', '<html><title>Just a moment...</title><main>Verify</main></html>', `<html><title>Paywalled article</title><script type="application/ld+json">{"@type":"NewsArticle","isAccessibleForFree":false}</script>${body}</html>`, `<html><title>Subscription required</title><main><p>${paragraph.repeat(2)} Subscribe to continue reading.</p></main></html>`]) assert.throws(() => extractArticle(sample, url, 'kci'), CollectionError);
});

test('excerpt is bounded while content hash represents complete extracted body', () => {
  const longHtml = `<html><title>Long article body test</title><article><p>${paragraph.repeat(120)}</p></article></html>`;
  const result = extractArticle(longHtml, url, 'kci');
  assert.equal(result.excerpt.length, 12000);
  assert.notEqual(result.contentHash, extractArticle(`<html><title>Long article body test</title>${body}</html>`, url, 'kci').contentHash);
});

test('redirect destinations are checked before fetching and policy errors do not expose page bodies', async () => {
  let count = 0;
  await assert.rejects(() => collectArticle({ url, companyId: 'kci', fetchFn: async () => { count++; return new Response(null, { status: 302, headers: { location: 'https://localhost/private' } }); } }), CollectionError);
  assert.equal(count, 1);
  await assert.rejects(() => collectArticle({ url, companyId: 'kci', fetchFn: async () => new Response('credential=secret', { status: 403 }) }), /HTTP 403/);
});

test('successful allowed redirect preserves actual fetched URL, HTML-only response requirement', async () => {
  const seen = [];
  const result = await collectArticle({ url, companyId: 'ncchem', retrievedAtISO: '2026-10-28T00:00:00Z', fetchFn: async (target, options) => { seen.push(target); assert.equal(options.redirect, 'manual'); return seen.length === 1 ? new Response(null, { status: 302, headers: { location: '/resolved/' } }) : new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } }); } });
  assert.equal(result.url, 'https://semiengineering.com/resolved/');
  await assert.rejects(() => collectArticle({ url, companyId: 'kci', fetchFn: async () => new Response('pdf bytes', { headers: { 'content-type': 'application/pdf' } }) }), /HTML/);
});
