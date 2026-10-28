import { createHash } from 'node:crypto';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { isIP } from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fetch, ProxyAgent } from 'undici';

export const QUERIES = [
  { companyId: 'ncchem', query: '(photoresist OR "EUV materials" OR JSR OR "Tokyo Ohka" OR "semiconductor chemicals") when:90d' },
  { companyId: 'kci', query: '("conditioning polymers" OR polyquaternium OR "hair care ingredients" OR "Samyang KCI") when:90d' },
  { companyId: 'verdant', query: '(surfactant OR biosurfactant OR Stepan OR Nouryon OR "Verdant Specialty") when:90d' },
].map((source) => ({ ...source, url: `https://news.google.com/rss/search?${new URLSearchParams({ q: source.query, hl: 'en-US', gl: 'US', ceid: 'US:en' })}` }));
const COMPANY_IDS = new Set(QUERIES.map((source) => source.companyId));
const MAX_FEED_BYTES = 2 * 1024 * 1024;
const SPAM = /market\s+size|\bcagr\b|market\s+research\s+report|market\s+(?:report|to\s+(?:reach|grow))|growth\s+(?:forecast|projections?)|\b20\d{2}\s*[-–]\s*20\d{2}\b/i;
const RELEVANCE = {
  ncchem: /photo\s?resist|\beuv\b|tokyo\s+ohka|semiconductor\s+(?:chemical|material)|electronic\s+(?:chemical|material)|포토레지스트|감광|반도체.{0,15}(?:소재|화학)|엔씨켐|(?:\bjsr\b|\btok\b).{0,80}(?:material|chemical|semiconductor|resist)|(?:material|chemical|semiconductor|resist).{0,80}(?:\bjsr\b|\btok\b)/i,
  kci: /conditioning\s+polymer|polyquaternium|hair\s?care.{0,40}(?:ingredient|condition|polymer)|(?:ingredient|polymer).{0,40}hair\s?care|samyang\s*kci|삼양\s*kci|컨디셔닝\s*폴리머|폴리쿼터늄/i,
  verdant: /surfactant|biosurfactant|nouryon|verdant\s+specialty|계면활성|(?:\bstepan\b).{0,80}(?:chemical|material|personal|care|plant|earnings)|(?:chemical|material|personal|care|plant|earnings).{0,80}\bstepan\b/i,
};

export class FeedError extends Error {}

function decode(value) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };
  return String(value).replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (full, entity) => {
    if (!entity.startsWith('#')) return entities[entity.toLowerCase()] ?? full;
    const number = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff) ? String.fromCodePoint(number) : '';
  });
}

function plain(value) {
  return decode(decode(String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'))).replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function tag(xml, name) { return xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}\\s*>`, 'i'))?.[1] || ''; }
function normalizeTitle(title) { return title.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }

export function publicUrl(value, article = false) {
  let url;
  try { url = new URL(plain(value)); } catch { return null; }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || (url.port && !['443', '80'].includes(url.port)) || !hostname.includes('.') || isIP(hostname) || /(?:^|\.)(?:localhost|local|internal|localdomain|test)$/.test(hostname)) return null;
  if (article) {
    if (url.hostname === 'news.google.com' && !/^\/(?:rss\/)?articles\/[^/]+/.test(url.pathname)) return null;
    if (/^\/?$/.test(url.pathname) || /^\/(?:search|rss|feed|login|signin|subscribe)\/?$/i.test(url.pathname) || /\.(?:pdf|xml|rss|json)$/i.test(url.pathname)) return null;
  }
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (/^utm_|^(?:oc|gclid|fbclid)$/i.test(key)) url.searchParams.delete(key);
  return url;
}

export function seoulDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function windowStart(now) {
  return Date.parse(`${seoulDate(now)}T00:00:00+09:00`) - 89 * 86400000;
}

function sourceDate(value) {
  const text = plain(value);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i);
  const rfc = text.match(/^(?:[a-z]{3},?\s+)?(\d{1,2})\s+([a-z]{3})\s+(\d{4})\s+\d{2}:\d{2}(?::\d{2})?\s+(?:GMT|UT|UTC|[+-]\d{4})$/i);
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  if (!iso && !rfc) return null;
  const [year, month, day] = iso ? [Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])] : [Number(rfc[3]), months.indexOf(rfc[2].toLowerCase()), Number(rfc[1])];
  const calendar = new Date(Date.UTC(year, month, day));
  if (month < 0 || calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month || calendar.getUTCDate() !== day) return null;
  const parsed = new Date(text);
  return Number.isFinite(parsed.valueOf()) ? parsed : null;
}
function fresh(item, now) {
  const timestamp = Date.parse(item.publishedAtISO);
  return Number.isFinite(timestamp) && timestamp <= now.valueOf() && timestamp >= windowStart(now);
}

export function parseRss(xml, companyId, now = new Date()) {
  if (!COMPANY_IDS.has(companyId)) throw new FeedError('지원하지 않는 사업 ID입니다.');
  if (typeof xml !== 'string' || /<!DOCTYPE|<!ENTITY/i.test(xml) || !/<rss\b/i.test(xml) || !/<channel\b/i.test(xml)) throw new FeedError('지원하는 RSS 피드 형식이 아닙니다.');
  const items = [];
  for (const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item\s*>/gi)) {
    const raw = match[1];
    const sourceTag = raw.match(/<source\b([^>]*)>([\s\S]*?)<\/source\s*>/i);
    const sourceName = plain(sourceTag?.[2] || '').slice(0, 200);
    let title = plain(tag(raw, 'title')).slice(0, 500);
    if (sourceName && title.toLowerCase().endsWith(` - ${sourceName.toLowerCase()}`)) title = title.slice(0, -(sourceName.length + 3)).trim();
    const link = publicUrl(tag(raw, 'link'), true);
    const published = sourceDate(tag(raw, 'pubDate'));
    if (!title || !sourceName || !link || !published) continue;
    const description = plain(tag(raw, 'description')).slice(0, 1600);
    // Search-feed descriptions can contain related-link lists; require the
    // headline itself to match the business rather than importing those lists.
    if (SPAM.test(title) || !RELEVANCE[companyId].test(title)) continue;
    const publishedAtISO = published.toISOString();
    if (!fresh({ publishedAtISO }, now)) continue;
    const sourceUrl = link.href;
    const rawPublisher = sourceTag?.[1].match(/\burl\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    const publisher = rawPublisher ? publicUrl(rawPublisher[1] || rawPublisher[2]) : null;
    items.push({
      id: `news-${createHash('sha256').update(`${sourceUrl}\n${normalizeTitle(title)}`).digest('hex').slice(0, 20)}`,
      title, sourceName, sourceUrl, ...(publisher ? { publisherUrl: publisher.origin } : {}),
      publishedAtISO, date: seoulDate(published), companyIds: [companyId],
      summary: description ? `RSS 제공 요약(기사 본문 미확인): ${description}` : 'RSS 메타데이터만 수집했습니다. 원문 본문은 확인하지 않았습니다.',
      verification: 'feed-metadata',
    });
  }
  return items;
}

export function deduplicate(items) {
  const results = [];
  const links = new Map();
  const titles = new Map();
  for (const item of items) {
    const normalizedUrl = publicUrl(item.sourceUrl, true)?.href;
    if (!normalizedUrl) continue;
    const titleKey = `${normalizeTitle(item.title)}\n${normalizeTitle(item.sourceName)}`;
    const previous = links.get(normalizedUrl) || titles.get(titleKey);
    if (previous) {
      previous.companyIds = [...new Set([...previous.companyIds, ...item.companyIds])].filter((id) => COMPANY_IDS.has(id));
      links.set(normalizedUrl, previous);
      continue;
    }
    const copy = { ...item, sourceUrl: normalizedUrl, companyIds: [...new Set(item.companyIds)].filter((id) => COMPANY_IDS.has(id)) };
    results.push(copy); links.set(normalizedUrl, copy); titles.set(titleKey, copy);
  }
  return results;
}

export async function fetchFeedXml(url, { dispatcher, fetchFn = fetch } = {}) {
  const parsed = new URL(url);
  if (parsed.origin !== 'https://news.google.com' || parsed.pathname !== '/rss/search' || parsed.username || parsed.password) throw new FeedError('지원하지 않는 피드 주소입니다.');
  let response;
  try { response = await fetchFn(parsed.href, { redirect: 'manual', signal: AbortSignal.timeout(25000), headers: { Accept: 'application/rss+xml,application/xml,text/xml', 'User-Agent': 'CHEM2-MI-RSS/1.0' }, ...(dispatcher ? { dispatcher } : {}) }); }
  catch { throw new FeedError('RSS 네트워크 요청을 완료하지 못했습니다.'); }
  if (!response.ok) { await response.body?.cancel(); throw new FeedError(`RSS 서버 응답 HTTP ${response.status}.`); }
  if (!/(?:application\/(?:rss\+xml|xml)|text\/xml)/i.test(response.headers.get('content-type') || '')) { await response.body?.cancel(); throw new FeedError('RSS XML 응답을 받지 못했습니다.'); }
  if (Number(response.headers.get('content-length')) > MAX_FEED_BYTES) { await response.body?.cancel(); throw new FeedError('RSS 응답이 2MB 제한을 초과했습니다.'); }
  const chunks = []; let bytes = 0;
  try {
    for await (const chunk of response.body) { bytes += chunk.byteLength; if (bytes > MAX_FEED_BYTES) throw new FeedError('RSS 응답이 2MB 제한을 초과했습니다.'); chunks.push(Buffer.from(chunk)); }
  } catch (error) { if (error instanceof FeedError) throw error; throw new FeedError('RSS 본문을 끝까지 읽지 못했습니다.'); }
  return Buffer.concat(chunks).toString('utf8');
}

export async function refreshSnapshot({ previous = {}, now = new Date(), readFeed = fetchFeedXml } = {}) {
  if (!Number.isFinite(now.valueOf())) throw new FeedError('수집 기준 시각이 올바르지 않습니다.');
  const attemptedAtISO = now.toISOString();
  const results = await Promise.all(QUERIES.map(async (source) => {
    try { const items = parseRss(await readFeed(source.url), source.companyId, now); return { source, items, status: 'ok' }; }
    catch (error) { return { source, items: [], status: 'error', error: error instanceof FeedError ? error.message : 'RSS 요청 또는 파싱에 실패했습니다.' }; }
  }));
  const failed = new Set(results.filter((result) => result.status === 'error').map((result) => result.source.companyId));
  const sources = results.map((result) => ({ companyId: result.source.companyId, url: result.source.url, status: result.status, itemCount: result.items.length, ...(result.error ? { error: result.error } : {}) }));
  const errors = results.filter((result) => result.error).map((result) => `${result.source.companyId}: ${result.error}`);
  if (failed.size === QUERIES.length) {
    return { schema: 'chem2.news.v1', attemptedAtISO, updatedAtISO: previous.updatedAtISO || null, lastSuccessfulAtISO: previous.lastSuccessfulAtISO || null, status: 'error', items: Array.isArray(previous.items) ? previous.items : [], sources, errors };
  }
  const retained = (Array.isArray(previous.items) ? previous.items : []).filter((item) => item.verification === 'feed-metadata' && fresh(item, now) && Array.isArray(item.companyIds) && item.companyIds.some((id) => failed.has(id))).map((item) => ({ ...item, companyIds: item.companyIds.filter((id) => failed.has(id)) }));
  const merged = deduplicate([...results.flatMap((result) => result.items), ...retained]).sort((a, b) => b.publishedAtISO.localeCompare(a.publishedAtISO));
  const counts = Object.fromEntries([...COMPANY_IDS].map((id) => [id, 0]));
  const items = [];
  for (const item of merged) {
    const companyIds = item.companyIds.filter((id) => counts[id] < 30);
    if (!companyIds.length) continue;
    items.push({ ...item, companyIds });
    for (const id of companyIds) counts[id] += 1;
    if (items.length >= 60) break;
  }
  return { schema: 'chem2.news.v1', attemptedAtISO, updatedAtISO: attemptedAtISO, lastSuccessfulAtISO: failed.size ? previous.lastSuccessfulAtISO || null : attemptedAtISO, status: failed.size ? 'partial' : 'ready', items, sources, errors };
}

export function parseArgs(args) {
  if (args.length === 0) return { out: 'public/latest-news.json' };
  if (args.length === 1 && args[0] === '--help') return { help: true };
  if (args.length === 2 && args[0] === '--out' && args[1] && !args[1].startsWith('--')) return { out: args[1] };
  throw new FeedError('사용법: node scripts/refresh-news.mjs [--out public/latest-news.json]');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { console.log('node scripts/refresh-news.mjs [--out public/latest-news.json]\n공개 RSS 메타데이터만 갱신합니다. 기사 본문·유료벽은 읽지 않으며 사실 검증을 주장하지 않습니다.'); return; }
  let previous = {};
  try { previous = JSON.parse(await readFile(options.out, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new FeedError('기존 스냅샷을 읽지 못했습니다. 파일을 보존하고 오류를 확인하세요.'); }
  const dispatcher = process.env.HTTPS_PROXY ? new ProxyAgent(process.env.HTTPS_PROXY) : undefined;
  try {
    const snapshot = await refreshSnapshot({ previous, readFeed: (url) => fetchFeedXml(url, { dispatcher }) });
    const temporary = `${options.out}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx', mode: 0o644 });
    await rename(temporary, options.out);
    console.log(`RSS snapshot: ${snapshot.status}, ${snapshot.items.length} metadata items. Article bodies not read.`);
    if (snapshot.status === 'error') process.exitCode = 1;
  } finally { await dispatcher?.close(); }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => { console.error(error instanceof FeedError ? error.message : 'RSS 스냅샷 저장에 실패했습니다.'); process.exitCode = 1; });
}
