import { Bookmark, Clock3, ExternalLink, FileText, FolderOpen, Map, Rss, Sparkles } from 'lucide-react';
import { selectRecentArticles } from '../shared/freshness.mjs';
import { companies, type CompanyId, type Signal } from './data';
import { newsToSignal, type NewsSnapshot } from './newsClient';
import './dashboard.css';

type Scope = CompanyId | 'all';

type Props = {
  scope: Scope;
  snapshot: NewsSnapshot;
  newsError: string;
  registered: Signal[];
  savedSignals: Signal[];
  onNews: () => void;
  onMap: () => void;
  onBrief: () => void;
  onAnalyze: () => void;
  onLibrary: (tab: 'saved' | 'sources') => void;
};

const collectionTime = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

const collectionStatuses = {
  ready: '수집 완료',
  partial: '일부 출처 수집 실패',
  error: '마지막 수집 실패',
  'not-configured': '첫 수집 대기 중',
} satisfies Record<NewsSnapshot['status'], string>;

function includesScope(signal: Signal, scope: Scope) {
  return scope === 'all' || signal.companyId === scope || signal.companyIds?.includes(scope);
}

export default function Dashboard({ scope, snapshot, newsError, registered, savedSignals, onNews, onMap, onBrief, onAnalyze, onLibrary }: Props) {
  const scopeName = companies.find(company => company.id === scope)?.name ?? '화학2그룹 전체';
  const { items: news } = selectRecentArticles(
    snapshot.items.map(newsToSignal).filter(signal => includesScope(signal, scope)),
    { asOfISO: new Date().toISOString(), days: 7 },
  );
  const lastSuccess = snapshot.lastSuccessfulAtISO;
  const status = snapshot.status === 'ready' && newsError ? '갱신 확인 실패' : collectionStatuses[snapshot.status];
  const issue = newsError || snapshot.errors[0];
  const stats = [
    { label: '최근 7일 뉴스', value: news.length, detail: 'RSS 발행일 기준', icon: Rss, action: onNews },
    { label: '북마크', value: savedSignals.filter(signal => includesScope(signal, scope)).length, detail: '선택 범위의 저장 자료', icon: Bookmark, action: () => onLibrary('saved') },
    { label: '등록 자료', value: registered.filter(signal => includesScope(signal, scope)).length, detail: '이 브라우저에 보관', icon: FolderOpen, action: () => onLibrary('sources') },
  ];
  const actions = [
    { label: '산업 지도', detail: '공정과 주요 기업의 역할을 살펴봅니다.', icon: Map, action: onMap },
    { label: '주간 브리핑', detail: '기간을 정해 기사와 등록 자료를 검토합니다.', icon: FileText, action: onBrief },
    { label: '핵심 인사이트 살펴보기', detail: '현재 범위의 자료에서 후속 조사 항목을 찾습니다.', icon: Sparkles, action: onAnalyze },
  ];

  return <div className="mi-overview">
    <section className="mi-overview-intro" aria-labelledby="overview-scope-heading">
      <div className="mi-overview-intro-copy">
        <span>선택한 사업 범위</span>
        <h2 id="overview-scope-heading">{scopeName}</h2>
        <p>최근 시장 뉴스와 기획팀이 모아둔 자료를 한눈에 확인하세요.</p>
      </div>
      <div className="mi-overview-collection">
        <div className="mi-overview-collection-heading"><Clock3 size={19} aria-hidden="true" />마지막 RSS 수집 성공</div>
        {lastSuccess ? <time dateTime={lastSuccess}>{collectionTime.format(new Date(lastSuccess))} KST</time> : <strong>성공한 수집 없음</strong>}
        <p className="mi-overview-collection-status" role="status">{status}</p>
        {issue && <p className="mi-overview-collection-issue">{issue}</p>}
      </div>
    </section>

    <div className="mi-overview-stats" role="group" aria-label="선택한 사업의 자료 현황">
      {stats.map(({ label, value, detail, icon: Icon, action }) => <button className="mi-overview-stat" key={label} onClick={action}>
        <span className="mi-overview-icon"><Icon size={20} aria-hidden="true" /></span>
        <span className="mi-overview-stat-copy">
          <span className="mi-overview-stat-label">{label}</span>
          <strong>{value}<span>건</span></strong>
          <span className="mi-overview-stat-detail">{detail}</span>
        </span>
      </button>)}
    </div>

    <div className="mi-overview-content">
      <section className="mi-overview-panel" aria-labelledby="overview-news-heading">
        <div className="mi-overview-panel-heading">
          <div>
            <h2 id="overview-news-heading">최근 시장 뉴스</h2>
            <p>최근 7일 RSS 수집분 · 기사 본문 미열람</p>
          </div>
          <button className="mi-overview-link" onClick={onNews}>뉴스 전체 보기</button>
        </div>
        {news.length > 0 ? <ul className="mi-overview-news">
          {news.slice(0, 4).map(signal => <li key={signal.id}>
            <div className="mi-overview-news-meta">
              <time dateTime={signal.date}>{signal.date}</time><span>{signal.sourceName}</span>
            </div>
            <a href={signal.sourceUrl} target="_blank" rel="noreferrer">
              <span>{signal.title}</span><ExternalLink size={16} aria-hidden="true" />
            </a>
          </li>)}
        </ul> : <div className="mi-overview-empty">
          <span className="mi-overview-icon"><Rss size={22} aria-hidden="true" /></span>
          <strong>선택 범위에 최근 7일 뉴스가 없습니다.</strong>
          <p>최신 뉴스 화면에서 30일 또는 90일로 넓혀 볼 수 있습니다.</p>
        </div>}
      </section>

      <section className="mi-overview-panel" aria-labelledby="overview-actions-heading">
        <div className="mi-overview-panel-heading"><h2 id="overview-actions-heading">기획 업무 바로가기</h2></div>
        <div className="mi-overview-actions">
          {actions.map(({ label, detail, icon: Icon, action }) => <button className="mi-overview-action" key={label} onClick={action}>
            <span className="mi-overview-icon"><Icon size={20} aria-hidden="true" /></span>
            <span><strong>{label}</strong><small>{detail}</small></span>
          </button>)}
        </div>
      </section>
    </div>
  </div>;
}
