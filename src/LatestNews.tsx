import { useEffect, useRef, useState } from 'react';
import { Bookmark, CalendarDays, Check, ChevronDown, Clock3, ExternalLink, Link2, LoaderCircle, RefreshCw, Rss } from 'lucide-react';
import { selectRecentArticles, type FreshnessDays } from '../shared/freshness.mjs';
import { companies, type CompanyId, type Signal } from './data';
import { newsToSignal, type NewsSnapshot } from './newsClient';
import './latest-news.css';

type Props = {
  snapshot: NewsSnapshot;
  loading: boolean;
  error: string;
  refresh: () => void;
  scope: CompanyId | 'all';
  query: string;
  category: string;
  registered: Signal[];
  savedIds: string[];
  onToggleSaved: (signal: Signal) => void;
  onRegister: (signal: Signal) => void;
};

const searchTerms: Record<CompanyId | 'all', string> = {
  all: '(photoresist OR polyquaternium OR surfactant)',
  ncchem: '(photoresist OR "EUV materials" OR "semiconductor chemicals")',
  kci: '(polyquaternium OR "hair care ingredients" OR "Samyang KCI")',
  verdant: '(surfactant OR biosurfactant OR "Verdant Specialty" OR Nouryon)',
};

const collectionStatusUrl = 'https://github.com/roadmaster1002/roadmaster1002/actions/workflows/refresh-news.yml';
const statusMessages = {
  partial: '일부 출처의 수집이 완료되지 않았습니다.',
  error: '마지막 수집이 실패했습니다. 이전 저장본을 유지합니다.',
  'not-configured': '첫 뉴스 수집을 기다리고 있습니다.',
  ready: '갱신 상태를 확인하지 못했습니다.',
};

function timestamp(value: string | null) {
  if (!value) return '성공한 수집 없음';
  return new Date(value).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export default function LatestNews({
  snapshot, loading, error, refresh, scope, query, category, registered, savedIds, onToggleSaved, onRegister,
}: Props) {
  const [days, setDays] = useState<FreshnessDays>(7);
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [savedOnly, setSavedOnly] = useState(false);
  const [copied, setCopied] = useState('');
  const savedFilter = useRef<HTMLButtonElement>(null);
  const saved = new Set(savedIds);
  const sourceItems = new Map(snapshot.items.map(item => [item.id, item]));
  const live = snapshot.items.map(newsToSignal);
  const seen = new Set<string>();
  const all = [...registered, ...live].filter(signal => {
    if (signal.isDemo || seen.has(signal.id)) return false;
    seen.add(signal.id);
    return scope === 'all' || signal.companyId === scope || signal.companyIds?.includes(scope);
  });
  const fresh = selectRecentArticles(all, { asOfISO: new Date().toISOString(), days });
  const terms = query.normalize().toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = fresh.items.filter(signal => {
    if (category !== '전체' && signal.category !== category) return false;
    if (!terms.length) return true;
    const original = sourceItems.get(signal.id);
    const text = [
      signal.title, original?.title, signal.sourceName, signal.category,
      signal.summary, original?.summary, signal.competitor, ...signal.tags,
    ].join(' ').normalize().toLowerCase();
    return terms.every(term => text.includes(term));
  });
  const savedCount = matches.filter(signal => saved.has(signal.id)).length;
  const items = savedOnly ? matches.filter(signal => saved.has(signal.id)) : matches;
  if (sort === 'oldest') items.sort((a, b) => a.date.localeCompare(b.date));
  const searchQuery = `${searchTerms[scope]} when:${days}d`;
  const searchUrl = `https://news.google.com/search?${new URLSearchParams({ q: searchQuery, hl: 'en-US', gl: 'US', ceid: 'US:en' })}`;
  const hasTextFilters = terms.length > 0 || category !== '전체';

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(''), 1800);
    return () => clearTimeout(timeout);
  }, [copied]);

  async function copy(signal: Signal) {
    try {
      await navigator.clipboard.writeText(signal.sourceUrl);
      setCopied(signal.id);
    } catch {
      setCopied('');
    }
  }

  return <div className="latest-news-panel">
    <div className="latest-controls">
      <div className="latest-window" role="group" aria-label="뉴스 발행 기간">
        {([7, 30, 90] as const).map(day => <button key={day} aria-pressed={days === day} className={days === day ? 'active' : ''} onClick={() => setDays(day)}>최근 {day}일</button>)}
      </div>
      <button className="btn secondary latest-refresh" onClick={refresh} disabled={loading}>
        {loading ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />}뉴스 갱신 확인
      </button>
    </div>
    <div className="latest-result-bar">
      <div className="latest-freshness">
        <span aria-live="polite"><CalendarDays size={17} />발행일 기준 최근 {days}일 <strong>{items.length}건</strong></span>
        <span><Clock3 size={16} />마지막 수집 성공 {timestamp(snapshot.lastSuccessfulAtISO)}</span>
      </div>
      <div className="latest-result-options">
        <button ref={savedFilter} className="latest-saved-filter" aria-label="저장한 항목만" aria-pressed={savedOnly} onClick={() => setSavedOnly(!savedOnly)}>
          <Bookmark size={17} aria-hidden="true" />저장한 항목만 <span aria-hidden="true">{savedCount}</span>
        </button>
        <label className="latest-sort">
          <select aria-label="기사 정렬" value={sort} onChange={event => setSort(event.target.value === 'oldest' ? 'oldest' : 'newest')}>
            <option value="newest">최신순</option>
            <option value="oldest">오래된순</option>
          </select>
          <ChevronDown size={16} aria-hidden="true" />
        </label>
      </div>
    </div>
    {(error || snapshot.status !== 'ready') && <div className="latest-status-note" role="status">
      <strong>{statusMessages[snapshot.status]}</strong>
      <p>{error || snapshot.errors[0] || '등록한 기사는 아래에서 바로 볼 수 있습니다.'}</p>
      <a href={collectionStatusUrl} target="_blank" rel="noreferrer">자동 수집 실행 상태<ExternalLink size={15} /></a>
    </div>}
    <div className="latest-evidence-note">
      <Rss size={18} aria-hidden="true" />
      <p>RSS는 제목·발행처·발행일·링크를 제공합니다. <strong>기사 본문은 별도 확인이 필요합니다.</strong> 번역이 있는 기사는 한글 제목과 영어 원제를 함께 확인할 수 있습니다. 사업과 유형은 키워드로 분류합니다.</p>
    </div>
    {items.length > 0 ? <div className="latest-grid">
      {items.map(signal => {
        const original = sourceItems.get(signal.id);
        const isSaved = saved.has(signal.id);
        const isFeed = signal.evidenceType === 'feed-metadata';
        return <article className="latest-card" key={signal.id}>
          <div className="latest-card-top">
            <time dateTime={signal.date}>{signal.date}</time>
            <span>{isFeed ? 'RSS · 본문 미열람' : '사용자 등록 자료'}</span>
          </div>
          <div className="latest-businesses">
            {(signal.companyIds || [signal.companyId]).map(id => <span className={`company-label ${id}`} key={id}><span />{companies.find(company => company.id === id)?.name}</span>)}
            <span className="latest-category">{signal.category}</span>
          </div>
          <h3><a href={signal.sourceUrl} target="_blank" rel="noreferrer">{signal.title}<ExternalLink size={17} aria-hidden="true" /></a></h3>
          <p>{signal.summary}</p>
          {original && original.title !== signal.title && <details>
            <summary>영어 원제·수집 설명 보기</summary>
            <p lang="en">{original.title}</p>
            {original.summary && <p>{original.summary}</p>}
          </details>}
          <div className="latest-source">{signal.sourceName} <span>· {isFeed ? '피드 발행일 기준' : '입력된 원문 발표일 기준'}</span></div>
          <div className="latest-card-actions">
            <a href={signal.sourceUrl} target="_blank" rel="noreferrer">기사 링크 열기<ExternalLink size={16} aria-hidden="true" /></a>
            <button className="latest-copy" aria-label={`${signal.title} 링크 복사`} onClick={() => copy(signal)}>
              {copied === signal.id ? <Check size={17} aria-hidden="true" /> : <Link2 size={17} aria-hidden="true" />}
            </button>
            <button className="latest-bookmark" aria-label={`${signal.title} 북마크`} aria-pressed={isSaved} onClick={() => {
              if (savedOnly && isSaved) savedFilter.current?.focus();
              onToggleSaved(signal);
            }}>
              <Bookmark size={17} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />북마크
            </button>
            <button className="latest-register" onClick={() => onRegister(signal)}>읽은 내용·분석 등록</button>
          </div>
        </article>;
      })}
    </div> : <div className="latest-empty">
      <Rss size={35} aria-hidden="true" />
      <h3>{savedOnly ? '조건에 맞는 저장 항목이 없습니다.' : hasTextFilters ? '검색 조건에 맞는 자료가 없습니다.' : `최근 ${days}일 조건의 자료가 없습니다.`}</h3>
      <p>{savedOnly ? '현재 사업과 발행 기간에 해당하는 기사만 표시합니다.' : hasTextFilters ? '검색어, 신호 유형 또는 발행 기간을 변경해 보세요.' : <>이 결과만으로 시장에 변화가 없었다고 판단할 수 없습니다.<br />수집 상태를 확인하거나 실제 기사 내용을 등록해 주세요.</>}</p>
      <div>
        {savedOnly && <button className="btn primary" onClick={() => setSavedOnly(false)}>저장 필터 해제</button>}
        {!savedOnly && <a className="btn primary" href={searchUrl} target="_blank" rel="noreferrer">최근 기사 직접 찾기<ExternalLink size={16} /></a>}
        {days !== 90 && <button className="btn secondary" onClick={() => setDays(days === 7 ? 30 : 90)}>최근 {days === 7 ? 30 : 90}일로 넓히기</button>}
        {!savedOnly && <a className="btn secondary" href={collectionStatusUrl} target="_blank" rel="noreferrer">수집 상태 확인<ExternalLink size={16} /></a>}
      </div>
    </div>}
    {(fresh.stats.older > 0 || fresh.stats.unknown > 0 || fresh.stats.future > 0) && <p className="latest-exclusions">
      기간 이전 {fresh.stats.older}건 · 발행일 미확인 {fresh.stats.unknown}건 · 미래 날짜 {fresh.stats.future}건을 제외했습니다.
    </p>}
  </div>;
}
