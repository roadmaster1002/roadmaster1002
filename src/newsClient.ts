import { useCallback, useEffect, useState } from 'react';
import initial from '../public/latest-news.json';
import { companies, type CompanyId, type Signal } from './data';

export type NewsItem = { id: string; title: string; sourceName: string; sourceUrl: string; publisherUrl?: string; publishedAtISO: string; date: string; companyIds: CompanyId[]; summary: string; verification: 'feed-metadata' };
export type NewsSnapshot = { schema: 'chem2.news.v1'; attemptedAtISO: string | null; updatedAtISO: string | null; lastSuccessfulAtISO: string | null; status: 'ready' | 'partial' | 'error' | 'not-configured'; items: NewsItem[]; sources: { companyId: CompanyId; url: string; status: 'ok' | 'error'; itemCount: number; error?: string }[]; errors: string[] };
const cacheKey = 'chem2-public-news-v1';
function safeUrl(value: unknown) {
  if (typeof value !== 'string') return false;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
function iso(value: unknown) { return value === null || (typeof value === 'string' && Number.isFinite(Date.parse(value))); }
export function validateSnapshot(value: unknown): NewsSnapshot {
  if (!value || typeof value !== 'object') throw new Error('뉴스 갱신 파일 형식이 올바르지 않습니다.');
  const v = value as NewsSnapshot;
  if (v.schema !== 'chem2.news.v1' || !['ready', 'partial', 'error', 'not-configured'].includes(v.status) || !Array.isArray(v.items) || v.items.length > 300 || !iso(v.attemptedAtISO) || !iso(v.updatedAtISO) || !iso(v.lastSuccessfulAtISO) || !Array.isArray(v.sources) || !Array.isArray(v.errors) || !v.errors.every(e => typeof e === 'string')) throw new Error('뉴스 갱신 파일을 확인할 수 없습니다.');
  if (!v.items.every(item => item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.sourceName === 'string' && safeUrl(item.sourceUrl) && (!item.publisherUrl || safeUrl(item.publisherUrl)) && typeof item.summary === 'string' && item.verification === 'feed-metadata' && typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && typeof item.publishedAtISO === 'string' && Number.isFinite(Date.parse(item.publishedAtISO)) && Array.isArray(item.companyIds) && item.companyIds.length > 0 && item.companyIds.every(id => companies.some(c => c.id === id)))) throw new Error('기사 메타데이터 형식이 올바르지 않습니다.');
  return v;
}
function initialSnapshot(): NewsSnapshot {
  const bundled = validateSnapshot(initial);
  try { const cached = validateSnapshot(JSON.parse(localStorage.getItem(cacheKey) || 'null')); return (cached.lastSuccessfulAtISO || '') > (bundled.lastSuccessfulAtISO || '') ? cached : bundled; } catch { return bundled; }
}
export function newsToSignal(item: NewsItem): Signal {
  const words = `${item.title} ${item.summary}`;
  const category: Signal['category'] = /regulat|restriction|compliance|REACH|PFAS|규제|정책/i.test(words) ? '규제·정책' : /invest|capacity|plant|factory|증설|투자/i.test(words) ? '투자·증설' : /photoresist|EUV|polymer|patent|research|기술|특허/i.test(words) ? '기술·특허' : '제품·시장';
  return { id: item.id, title: item.title, summary: item.summary || '제목·발행처·피드 발행일만 수집한 링크입니다. 기사 본문은 확인하지 않았습니다.', companyId: item.companyIds[0], companyIds: item.companyIds, evidenceType: 'feed-metadata', competitor: '키워드 분류', category, region: '글로벌', date: item.date, impact: '보통', sourceName: item.sourceName, sourceUrl: item.sourceUrl, isDemo: false, tags: ['뉴스 피드', '본문 미열람'], implication: '뉴스 피드의 제목·메타데이터입니다. 원문에서 발표일·제품·고객·지역과 핵심 근거를 확인한 후 사업 영향을 판단하세요. 사업 연결과 유형은 키워드 분류이며 실제 경쟁 관계나 영향도를 확인한 결과가 아닙니다.' };
}
export function useLatestNews() {
  const [snapshot, setSnapshot] = useState<NewsSnapshot>(initialSnapshot);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (window.location.protocol === 'file:') { setError('오프라인 파일은 포함된 갱신 자료와 이 브라우저의 마지막 저장본을 사용합니다.'); return; }
    setLoading(true); setError('');
    try {
      // The production site reads the public scheduled snapshot. It never scrapes
      // publishers or sends the browser's private research notes to GitHub.
      const url = window.location.hostname === 'roadmaster1002.github.io'
        ? `https://raw.githubusercontent.com/roadmaster1002/roadmaster1002/main/public/latest-news.json?refresh=${Date.now()}`
        : new URL('latest-news.json', document.baseURI).href;
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`뉴스 갱신 파일을 불러오지 못했습니다 (HTTP ${response.status}).`);
      const next = validateSnapshot(await response.json());
      setSnapshot(previous => {
        // A failed or older refresh must not erase a previously successful feed.
        const final = (previous.lastSuccessfulAtISO || '') > (next.lastSuccessfulAtISO || '')
          ? { ...previous, status: next.status, attemptedAtISO: next.attemptedAtISO, errors: next.errors, sources: next.sources }
          : next;
        try { localStorage.setItem(cacheKey, JSON.stringify(final)); } catch { /* public metadata cache is optional */ }
        return final;
      });
    } catch (e) { setError(e instanceof Error ? e.message : '뉴스 갱신 상태를 확인하지 못했습니다. 마지막 저장 자료를 유지합니다.'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { if (window.location.protocol !== 'file:') refresh(); }, [refresh]);
  return { snapshot, loading, error, refresh };
}
