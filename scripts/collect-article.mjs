import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fetch, ProxyAgent } from 'undici';

export const ALLOWED_HOSTS = new Set([
  'semiengineering.com', 'www.specialchem.com', 'cen.acs.org',
  'eur-lex.europa.eu', 'echa.europa.eu', 'www.asml.com', 'www.happi.com',
  'www.cosmeticsdesign-europe.com', 'global.canon', 'report.basf.com',
]);
const COMPANIES = new Set(['ncchem', 'kci', 'verdant']);
const MAX_BYTES = 3 * 1024 * 1024;
export class CollectionError extends Error {}

export function validateUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new CollectionError('유효한 HTTPS 기사 URL을 지정하세요.'); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !ALLOWED_HOSTS.has(url.hostname)) {
    throw new CollectionError('수집은 지정된 10개 발행처의 인증정보 없는 HTTPS URL만 허용합니다.');
  }
  url.hash = '';
  return url;
}

export function parseArgs(args) {
  if (args.length === 1 && args[0] === '--help') return { help: true };
  const values = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    if (!['--url', '--company', '--out'].includes(flag) || !args[i + 1] || args[i + 1].startsWith('--') || values[flag]) throw new CollectionError('필수 옵션은 --url URL --company ncchem|kci|verdant --out FILE입니다.');
    values[flag] = args[i + 1];
  }
  if (!values['--url'] || !values['--out'] || !COMPANIES.has(values['--company'])) throw new CollectionError('필수 옵션은 --url URL --company ncchem|kci|verdant --out FILE입니다.');
  return { url: validateUrl(values['--url']).href, companyId: values['--company'], out: values['--out'] };
}

function decodeEntities(value) {
  const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', copy: '©', reg: '®' };
  return String(value).replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (full, entity) => {
    if (entity[0] !== '#') return entities[entity.toLowerCase()] ?? full;
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
  });
}

export function htmlToText(html) {
  return decodeEntities(String(html)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|nav|footer|header|aside|noscript|form|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<(?:br|\/p|\/div|\/section|\/h[1-6]|\/li|\/blockquote)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[\t\r \f\v]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) result[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4]);
  return result;
}

function metadata(html) {
  const result = {};
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    const key = (attrs.property || attrs.name || '').toLowerCase();
    if (key && attrs.content && !result[key]) result[key] = attrs.content;
  }
  return result;
}

function articleJson(html) {
  const nodes = [];
  function visit(value, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 6) return;
    if (Array.isArray(value)) { for (const entry of value) visit(entry, depth + 1); return; }
    const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
    if (types.some((type) => typeof type === 'string' && /^(?:Article|NewsArticle|BlogPosting|TechArticle|ScholarlyArticle|Report)$/i.test(type.split(/[\/#]/).pop()))) nodes.push(value);
    if (value['@graph']) visit(value['@graph'], depth + 1);
    if (value.mainEntity) visit(value.mainEntity, depth + 1);
  }
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if ((attributes(match[1]).type || '').toLowerCase() !== 'application/ld+json') continue;
    try { visit(JSON.parse(match[2].trim().replace(/^<!--|-->$/g, ''))); } catch { /* malformed structured data is not evidence */ }
  }
  return nodes.find((node) => typeof node.headline === 'string') || nodes[0] || {};
}

export function publicationDate(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})(?:T|$|\s)/);
  if (!match) return null;
  const date = new Date(`${match[1]}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === match[1] ? match[1] : null;
}

export function extractArticle(html, sourceUrl, companyId, retrievedAtISO = new Date().toISOString()) {
  const url = validateUrl(sourceUrl);
  if (!COMPANIES.has(companyId)) throw new CollectionError('지원하는 사업 ID를 지정하세요.');
  if (typeof html !== 'string' || !/<(?:html|article|main|body)\b/i.test(html)) throw new CollectionError('지원하는 HTML 기사 본문이 아닙니다.');
  const meta = metadata(html);
  const structured = articleJson(html);
  if (structured.isAccessibleForFree === false || structured.isAccessibleForFree === 'false') throw new CollectionError('유료·구독 제한이 표시된 자료는 수집하지 않습니다. 원문 접근 권한을 확인하세요.');
  const title = htmlToText(structured.headline || meta['og:title'] || html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  if (title.length < 5 || title.length > 500 || /^(?:access denied|just a moment|403 forbidden|sign in|log in|attention required)/i.test(title)) throw new CollectionError('기사 제목을 확인할 수 없거나 접근 제한 페이지입니다.');
  const candidates = [...html.matchAll(/<(article|main)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)].map((match) => htmlToText(match[2]));
  if (typeof structured.articleBody === 'string') candidates.unshift(htmlToText(structured.articleBody));
  // A body-only fallback needs article metadata and multiple actual paragraphs.
  // Generic homepages/navigation shells are intentionally not imported as articles.
  if (!candidates.length && (structured['@type'] || meta['og:type'] === 'article')) {
    const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '';
    if ((body.match(/<p\b/gi) || []).length >= 3) candidates.push(htmlToText(body));
  }
  const text = candidates.sort((a, b) => b.length - a.length)[0] || '';
  if (text.length < 200 || text.split(/\s+/).length < 20) throw new CollectionError('읽을 수 있는 기사 본문이 부족합니다. 로그인·자바스크립트·PDF 자료는 수동으로 원문을 등록하세요.');
  if (text.length < 3000 && /subscribe to (?:continue|read|unlock)|sign in to (?:continue|read)|register to (?:continue|read)|already (?:a )?subscriber|구독 후 (?:계속|읽기)|로그인 후 (?:계속|열람)/i.test(text)) throw new CollectionError('구독·로그인 안내가 포함된 제한 페이지입니다. 접근을 우회하지 않습니다.');
  const rawPublisher = typeof structured.publisher === 'string' ? structured.publisher : structured.publisher?.name;
  const publisher = htmlToText(typeof rawPublisher === 'string' ? rawPublisher : meta['og:site_name'] || url.hostname).slice(0, 200);
  return {
    schema: 'chem2.article.v1', companyId, title, publisher, url: url.href,
    publishedDate: publicationDate(structured.datePublished) || publicationDate(meta['article:published_time']) || publicationDate(meta['datepublished']) || publicationDate(meta['citation_publication_date']),
    retrievedAtISO, excerpt: text.slice(0, 12000),
    contentHash: createHash('sha256').update(text).digest('hex'),
    verification: 'source-read',
    notes: { keyTakeaways: '', evidence: '', businessImpact: '', followUp: '' },
  };
}

export async function collectArticle({ url, companyId, fetchFn = fetch, dispatcher, retrievedAtISO }) {
  let current = validateUrl(url);
  for (let redirects = 0; redirects <= 4; redirects += 1) {
    let response;
    try {
      response = await fetchFn(current.href, { redirect: 'manual', signal: AbortSignal.timeout(25000), headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'CHEM2-MI-ArticleReader/0.1' }, ...(dispatcher ? { dispatcher } : {}) });
    } catch { throw new CollectionError('원문 요청을 완료하지 못했습니다. 네트워크 허용 정책과 TLS·프록시 설정을 확인하세요.'); }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      if (redirects === 4) throw new CollectionError('리디렉션 허용 횟수를 초과했습니다.');
      const location = response.headers.get('location');
      if (!location) throw new CollectionError('리디렉션 주소가 없습니다.');
      let target;
      try { target = new URL(location, current); } catch { throw new CollectionError('리디렉션 주소를 확인할 수 없습니다.'); }
      current = validateUrl(target.href);
      continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new CollectionError(`원문 서버가 HTTP ${response.status}로 요청을 거부했습니다. 접근 제한을 우회하지 않습니다.`); }
    if (!/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.headers.get('content-type') || '')) { await response.body?.cancel(); throw new CollectionError('HTML 기사만 지원합니다. PDF·파일은 수동 등록하세요.'); }
    if (Number(response.headers.get('content-length')) > MAX_BYTES) { await response.body?.cancel(); throw new CollectionError('원문 크기가 3MB 제한을 초과했습니다.'); }
    const chunks = [];
    let bytes = 0;
    try {
      for await (const chunk of response.body) {
        bytes += chunk.byteLength;
        if (bytes > MAX_BYTES) throw new CollectionError('원문 크기가 3MB 제한을 초과했습니다.');
        chunks.push(Buffer.from(chunk));
      }
    } catch (error) { if (error instanceof CollectionError) throw error; throw new CollectionError('원문 본문을 끝까지 읽지 못했습니다.'); }
    return extractArticle(Buffer.concat(chunks).toString('utf8'), current.href, companyId, retrievedAtISO);
  }
  throw new CollectionError('원문 요청을 완료하지 못했습니다.');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('node scripts/collect-article.mjs --url HTTPS_URL --company ncchem|kci|verdant --out /tmp/article.json\n기존 파일은 덮어쓰지 않습니다. source-read는 본문을 읽었다는 뜻이며 사실 검증·최신성 보증이 아닙니다.');
    return;
  }
  const proxy = process.env.HTTPS_PROXY ? new ProxyAgent(process.env.HTTPS_PROXY) : undefined;
  try {
    const article = await collectArticle({ ...options, dispatcher: proxy });
    try { await writeFile(options.out, `${JSON.stringify(article, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 }); }
    catch (error) { throw new CollectionError(error.code === 'EEXIST' ? '출력 파일이 이미 있습니다. 새 파일명을 지정하세요.' : '출력 파일을 저장하지 못했습니다. 경로와 권한을 확인하세요.'); }
    console.log(`기사 본문을 JSON으로 저장했습니다 (${article.excerpt.length}자). source-read는 원문 본문 수신을 의미하며 사실 검증 결과가 아닙니다. 발표일: ${article.publishedDate || '미확인'}.`);
  } finally { await proxy?.close(); }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => { console.error(error instanceof CollectionError ? error.message : '자료 수집에 실패했습니다. 설정을 확인하세요.'); process.exitCode = 1; });
}
