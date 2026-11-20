import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowUpRight, Bell, Bookmark, Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, Compass, ExternalLink, FileText, FolderOpen, Globe2, LayoutDashboard, LoaderCircle, Map as MapIcon, Menu, Plus, Radar, Search, Send, Settings2, ShieldCheck, Sparkles, X } from 'lucide-react';
import { companies, signals as seedSignals, watchTopics, type Company, type Signal } from './data';
import Dashboard from './Dashboard';
import IndustryMap from './IndustryMap';
import BrandLogo from './BrandLogo';
import ResearchFeed from './ResearchFeed';
import type { ResearchItem } from './researchData';
import { useLatestNews, newsToSignal } from './newsClient';
import WeeklyBrief from './WeeklyBrief';
import { getAnalysisStatus, requestAnalysis } from './analysisClient';

type Page = 'overview' | 'map' | 'feed' | 'watchlist' | 'brief' | 'library';
type Scope = 'all' | Company['id'];
type BookmarkEntry = string | Signal;
type ArticleDraft = { companyId: Company['id']; title: string; sourceName: string; sourceUrl: string; date: string; summary: string; category: Signal['category']; notes?: NonNullable<Signal['articleDetails']>['notes']; sourceExcerpt?: string; retrievedAt?: string; originalUrl?: string; contentHash?: string };
function isValidArticleDetails(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value !== 'object') return false;
  const v = value as Record<string, unknown>; const notes = v.notes as Record<string, unknown> | undefined;
  return Boolean(notes && ['keyTakeaways', 'evidence', 'businessImpact', 'followUp'].every(key => typeof notes[key] === 'string') && ['sourceExcerpt', 'retrievedAt', 'originalUrl', 'contentHash'].every(key => v[key] == null || typeof v[key] === 'string'));
}
type Analysis = { answer: string; mode: 'local' | 'llm'; citations: string[] };
const pageTitles: Record<Page, string> = { overview: '인텔리전스 대시보드', map: '산업 지도', feed: '마켓 인텔리전스', watchlist: '관심 모니터링', brief: '주간 브리핑', library: '리서치 라이브러리' };
const navItems = [
  { id: 'overview', label: '대시보드', icon: LayoutDashboard },
  { id: 'map', label: '산업 지도', icon: MapIcon },
  { id: 'feed', label: '마켓 인텔리전스', icon: Radar },
  { id: 'watchlist', label: '관심 모니터링', icon: Bookmark },
  { id: 'brief', label: '주간 브리핑', icon: FileText },
  { id: 'library', label: '리서치 라이브러리', icon: FolderOpen },
] as const;

function pageFromHash(): Page {
  const fragment = window.location.hash.slice(1);
  return navItems.find(item => item.id === fragment)?.id ?? 'map';
}

function belongsToScope(signal: Signal, scope: Scope) {
  return scope === 'all' || signal.companyId === scope || signal.companyIds?.includes(scope);
}

function isSafeSourceUrl(value: unknown) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

function isStoredNews(value: unknown): value is Signal {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Signal>;
  return item.evidenceType === 'feed-metadata' && item.isDemo === false &&
    ['id', 'title', 'summary', 'sourceName', 'competitor', 'category', 'region', 'impact', 'implication'].every(key => typeof item[key as keyof Signal] === 'string') &&
    typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
    companies.some(company => company.id === item.companyId) &&
    (!item.companyIds || (Array.isArray(item.companyIds) && item.companyIds.every(id => companies.some(company => company.id === id)))) &&
    !item.articleDetails && Array.isArray(item.tags) && item.tags.every(tag => typeof tag === 'string') &&
    isSafeSourceUrl(item.sourceUrl);
}

function readLegacyBookmarks(): BookmarkEntry[] {
  const value: unknown = JSON.parse(localStorage.getItem('chem2-saved-v1') || '[]');
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function bookmarkId(entry: BookmarkEntry) {
  return typeof entry === 'string' ? entry : entry.id;
}

function validStored(key: string, value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  if (key === 'chem2-bookmarks-v2') return value.every(entry => typeof entry === 'string' || isStoredNews(entry));
  if (key.includes('topics')) return value.every(x => typeof x === 'string');
  if (key.includes('briefs')) return value.every(x => x && typeof x.text === 'string' && typeof x.scope === 'string' && typeof x.mode === 'string' && Number.isFinite(Date.parse(x.date)));
  if (key.includes('sources')) return value.every(x => x && typeof x.id === 'string' && typeof x.title === 'string' && typeof x.summary === 'string' && typeof x.competitor === 'string' && typeof x.sourceName === 'string' && typeof x.sourceUrl === 'string' && /^https?:\/\//i.test(x.sourceUrl) && typeof x.implication === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && companies.some(c => c.id === x.companyId) && Array.isArray(x.tags) && x.tags.every((t: unknown) => typeof t === 'string') && x.isDemo === false && isValidArticleDetails(x.articleDetails));
  return true;
}
function useStored<T,>(key: string, fallback: T, legacy?: () => T) {
  const [storageError, setStorageError] = useState(false);
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : legacy?.() ?? fallback;
      return validStored(key, parsed) ? parsed : fallback;
    } catch { return fallback; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); setStorageError(false); } catch { setStorageError(true); } }, [key, value]);
  return [value, setValue, storageError] as const;
}
function companyFor(id: string) { return companies.find(c => c.id === id)!; }
function download(name: string, content: string, mimeType = 'text/markdown;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function todayInSeoul() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function dateLabel(value: string) { return value.slice(5).replace('-', '.'); }
function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} aria-labelledby={titleId} className={`modal ${wide ? 'wide' : ''}`} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal-header"><h2 id={titleId}>{title}</h2><button className="icon-btn" aria-label="닫기" onClick={onClose}><X size={20} /></button></div>{children}</dialog>;
}

export default function App() {
  const [page, setPage] = useState<Page>(pageFromHash);
  const [scope, setScope] = useState<Scope>('ncchem');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('전체');
  const [bookmarks, setBookmarks, savedError] = useStored<BookmarkEntry[]>('chem2-bookmarks-v2', [], readLegacyBookmarks);
  const [sources, setSources, sourcesError] = useStored<Signal[]>('chem2-sources-v1', []);
  const [topics, setTopics, topicsError] = useStored<string[]>('chem2-topics-v1', watchTopics.map(t => t.id));
  const [briefs, , briefsError] = useStored<{ date: string; text: string; scope: string; mode: string }[]>('chem2-briefs-v1', []);
  const [selected, setSelected] = useState<Signal | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [articleDraft, setArticleDraft] = useState<ArticleDraft | null>(null);
  const [settings, setSettings] = useState(false);
  const [help, setHelp] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiResult, setAiResult] = useState<Analysis | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [mode, setMode] = useState<'local' | 'llm'>('local');
  const [hosting, setHosting] = useState<'server' | 'static'>('static');
  const [libraryTab, setLibraryTab] = useState<'saved' | 'sources'>('saved');
  const pageHeading = useRef<HTMLHeadingElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const focusHeading = useRef(false);
  const news = useLatestNews();
  const newsSignals = useMemo(() => news.snapshot.items.map(newsToSignal), [news.snapshot.items]);
  const allSignals = [...sources, ...newsSignals, ...seedSignals];
  const companySignals = allSignals.filter(s => belongsToScope(s, scope));
  const filteredSignals = companySignals.filter(s => (category === '전체' || s.category === category) && `${s.title} ${s.summary} ${s.competitor} ${s.sourceName} ${s.tags.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()));
  const activeCompany = scope === 'all' ? null : companyFor(scope);
  const analysisSignals = [...companySignals].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40);
  const savedIds = bookmarks.map(bookmarkId);
  const allSignalsById = new Map(allSignals.map(signal => [signal.id, signal]));
  const savedSignals = bookmarks.flatMap(entry => {
    const signal = allSignalsById.get(bookmarkId(entry)) ?? (typeof entry === 'string' ? undefined : entry);
    return signal ? [signal] : [];
  }).reverse();
  const scopedSavedSignals = savedSignals.filter(signal => belongsToScope(signal, scope));
  const scopedSources = sources.filter(signal => belongsToScope(signal, scope));
  const libraryItems = libraryTab === 'saved' ? scopedSavedSignals : scopedSources;
  useEffect(() => {
    const byId = new Map(newsSignals.map(signal => [signal.id, signal]));
    setBookmarks(previous => {
      const upgraded = previous.map(entry => typeof entry === 'string' ? byId.get(entry) ?? entry : entry);
      return upgraded.some((entry, index) => entry !== previous[index]) ? upgraded : previous;
    });
  }, [newsSignals, setBookmarks]);
  useEffect(() => {
    function handleHashChange() {
      const next = pageFromHash();
      if (page !== next) {
        focusHeading.current = true;
        setPage(next);
      }
      setQuery('');
      setCategory('전체');
      setMenuOpen(false);
    }
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [page]);
  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    pageHeading.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [page]);
  useEffect(() => {
    if (!menuOpen) return;
    document.querySelector<HTMLButtonElement>('#workspace-sidebar [aria-current="page"]')?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      setMenuOpen(false);
      menuButton.current?.focus();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);
  useEffect(() => { getAnalysisStatus().then(v => { setMode(v.mode); setHosting(v.hosting); }).catch(() => {}); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3200); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (!addOpen) setArticleDraft(null); }, [addOpen]);
  function registerResearch(item?: ResearchItem) {
    setArticleDraft(item ? { companyId: item.companyId, title: item.title, sourceName: item.publisher, sourceUrl: item.url, date: item.publishedDate || '', summary: '', category: item.kind === '규제 원문' ? '규제·정책' : item.kind === '연차보고서' ? '제품·시장' : '기술·특허', notes: { keyTakeaways: '', evidence: '', businessImpact: '', followUp: item.readingQuestions.join('\n').slice(0, 450) } } : null);
    setAddOpen(true);
  }
  function registerNews(signal: Signal) {
    setArticleDraft({ companyId: scope === 'all' ? signal.companyId : scope, title: signal.title.slice(0, 180), sourceName: signal.sourceName.slice(0, 80), sourceUrl: signal.sourceUrl, date: signal.evidenceType === 'feed-metadata' ? '' : signal.date, summary: signal.evidenceType === 'feed-metadata' ? '' : signal.summary, category: signal.category, notes: { keyTakeaways: '', evidence: '', businessImpact: '', followUp: '원문에서 발표일·제품·고객·지역·핵심 근거를 확인하세요.' } });
    setAddOpen(true);
  }
  function importArticle(value: unknown) {
    if (!value || typeof value !== 'object') throw new Error('기사 JSON 형식을 확인해 주세요.');
    const v = value as Record<string, unknown>;
    if (v.schema !== 'chem2.article.v1' || !companies.some(c => c.id === v.companyId) || typeof v.title !== 'string' || typeof v.publisher !== 'string' || typeof v.url !== 'string' || typeof v.excerpt !== 'string' || v.verification !== 'source-read') throw new Error('chem2.article.v1 수집 파일이 아닙니다.');
    const url = new URL(v.url);
    if (url.protocol !== 'https:' || url.username || url.password || v.title.length > 500 || v.publisher.length > 200 || v.url.length > 2000 || v.excerpt.length > 12000) throw new Error('기사 출처 또는 본문 길이를 확인해 주세요.');
    if (v.publishedDate != null && (typeof v.publishedDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.publishedDate) || !Number.isFinite(Date.parse(v.publishedDate + 'T00:00:00Z')) || new Date(v.publishedDate + 'T00:00:00Z').toISOString().slice(0, 10) !== v.publishedDate)) throw new Error('기사 발표일 형식이 올바르지 않습니다.');
    setArticleDraft({ companyId: v.companyId as Company['id'], title: v.title.slice(0, 180), sourceName: v.publisher.slice(0, 80), sourceUrl: v.url, date: v.publishedDate as string || '', summary: v.excerpt.slice(0, 4000), category: '제품·시장', sourceExcerpt: v.excerpt, originalUrl: v.url, retrievedAt: typeof (v.retrievedAtISO ?? v.retrievedAt) === 'string' && Number.isFinite(Date.parse(String(v.retrievedAtISO ?? v.retrievedAt))) ? String(v.retrievedAtISO ?? v.retrievedAt) : undefined, contentHash: typeof v.contentHash === 'string' ? v.contentHash : undefined });
    setAddOpen(true); setToast('수집한 원문을 불러왔습니다. 발표일과 분석 노트를 확인한 후 등록하세요.');
  }
  function navigate(next: Page) {
    if (next !== page) {
      window.location.hash = next;
      return;
    }
    setQuery('');
    setCategory('전체');
    setMenuOpen(false);
    if (menuOpen) pageHeading.current?.focus();
  }
  function toggleSaved(signal: Signal) {
    setBookmarks(previous => previous.some(entry => bookmarkId(entry) === signal.id)
      ? previous.filter(entry => bookmarkId(entry) !== signal.id)
      : [...previous, signal.evidenceType === 'feed-metadata' ? signal : signal.id]);
  }
  async function analyze(question = aiQuestion) {
    if (!question.trim() || aiBusy) return;
    setAiOpen(true); setAiQuestion(question); setAiBusy(true); setAiError(''); setAiResult(null);
    try {
      const data = await requestAnalysis({ question, company: scope === 'all' ? '화학2그룹 전체' : scope, signals: analysisSignals });
      setAiResult(data);
    } catch (e) { setAiError(e instanceof Error ? e.message : '서버 연결을 확인해 주세요.'); } finally { setAiBusy(false); }
  }
  function addSource(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); const companyId = f.get('company') as Company['id'];
    const notes = { keyTakeaways: String(f.get('keyTakeaways') || '').trim(), evidence: String(f.get('evidence') || '').trim(), businessImpact: String(f.get('businessImpact') || '').trim(), followUp: String(f.get('followUp') || '').trim() };
    const detailedImplication = [['핵심 논점', notes.keyTakeaways], ['근거·수치', notes.evidence], ['사업 영향(사용자 분석)', notes.businessImpact], ['후속 조사', notes.followUp]].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
    const source: Signal = { id: `source-${crypto.randomUUID()}`, title: String(f.get('title')).trim(), summary: String(f.get('summary')).trim(), companyId, competitor: String(f.get('competitor') || '사용자 등록'), category: f.get('category') as Signal['category'], region: '글로벌', date: String(f.get('date')), impact: '보통', sourceName: String(f.get('sourceName')).trim(), sourceUrl: String(f.get('url')).trim(), isDemo: false, tags: [companyFor(companyId).sector, '등록 자료'], implication: detailedImplication || '사용자가 등록한 자료입니다. 원문 및 발표일을 확인한 후 경쟁 영향과 후속 조사 항목을 검토하세요.', articleDetails: { notes, sourceExcerpt: articleDraft?.sourceExcerpt, retrievedAt: articleDraft?.retrievedAt, originalUrl: articleDraft?.originalUrl, contentHash: articleDraft?.contentHash } };
    if (!source.title || !source.summary || !source.sourceName || !/^https?:\/\//i.test(source.sourceUrl) || (() => { try { const u = new URL(source.sourceUrl); return Boolean(u.username || u.password); } catch { return true; } })()) { setToast('제목·내용·출처명과 올바른 원문 URL을 입력해 주세요.'); return; }
    setSources(old => [source, ...old]); setAddOpen(false); setToast('분석할 자료가 등록되었습니다.');
  }
  const signalCard = (s: Signal, compact = false) => <article key={s.id} className={`signal-card ${compact ? 'compact' : ''}`}>
    <div className="signal-top"><span className={`company-label ${s.companyId}`}><span />{companyFor(s.companyId).shortName}</span><span className={`impact ${s.impact === '높음' ? 'high' : ''}`}><span />{s.impact === '높음' ? '주목할 신호' : s.category}</span><button className={`bookmark-btn ${savedIds.includes(s.id) ? 'active' : ''}`} aria-label={`${s.title} ${savedIds.includes(s.id) ? '저장 취소' : '저장'}`} aria-pressed={savedIds.includes(s.id)} onClick={() => toggleSaved(s)}><Bookmark size={17} fill={savedIds.includes(s.id) ? 'currentColor' : 'none'} /></button></div>
    <button className="signal-content" onClick={() => setSelected(s)}><h3>{s.title}<ArrowUpRight size={17} /></h3><p>{s.summary}</p></button>
    <div className="signal-tags">{s.tags.slice(0, 3).map(t => <span key={t}>{t}</span>)}</div>
    <div className="signal-bottom"><span className="source-avatar">{s.sourceName.slice(0, 1)}</span><span>{s.sourceName}</span><span className="meta-dot">·</span><span>{dateLabel(s.date)}</span><span className={`data-kind ${s.isDemo ? '' : 'real'}`}>{s.isDemo ? '예시 시나리오' : s.evidenceType === 'feed-metadata' ? 'RSS · 본문 미열람' : '등록 자료'}</span></div>
  </article>;

  return <div className="app-shell">
    {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
    <aside id="workspace-sidebar" className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <button className="brand" onClick={() => navigate('overview')} aria-label="삼양사 MI 홈"><BrandLogo /></button>
      <div className="workspace"><span className="workspace-icon">S</span><div><strong>삼양사 화학2그룹</strong><span>기획팀 워크스페이스</span></div><ChevronDown size={14} /></div>
      <div className="nav-label">WORKSPACE</div>
      <nav aria-label="워크스페이스 메뉴">{navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => navigate(id)} aria-current={page === id ? 'page' : undefined} className={page === id ? 'active' : ''}><Icon size={19} /><span>{label}</span></button>)}</nav>
      <div className="sidebar-line" /><div className="nav-label company-nav-heading">OUR BUSINESSES <span>03</span></div>
      <div className="company-nav">{companies.map(c => <button key={c.id} className={scope === c.id ? 'selected' : ''} onClick={() => setScope(scope === c.id ? 'all' : c.id)}><span className={`small-dot ${c.id}`} /><span>{c.shortName}</span><ChevronRight size={13} /></button>)}</div>
      <div className="sidebar-bottom"><div className="agent-status"><span className="agent-status-icon"><Sparkles size={18} /></span><div><strong>MI 분석 어시스턴트</strong><span><i />{mode === 'llm' ? 'LLM 설정됨' : '로컬 분석 모드'}</span></div><button aria-label="분석 설정" onClick={() => setSettings(true)}><Settings2 size={16} /></button></div><button className="help-button" onClick={() => setHelp(true)}><CircleHelp size={17} />워크스페이스 가이드<ArrowUpRight size={14} /></button><div className="sidebar-footer"><span>삼양사 화학2그룹</span><span>기획팀 워크스페이스</span></div></div>
    </aside>

    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button ref={menuButton} className="icon-btn mobile-menu" aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"} aria-controls="workspace-sidebar" aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)}><Menu size={21} /></button><span>Workspace</span><ChevronRight size={13} /><strong>{pageTitles[page]}</strong></div><div className="header-actions"><span className="demo-indicator"><span />MI 워크스페이스</span><button className="notification-btn icon-btn" aria-label="알림" onClick={() => setNotifications(true)}><Bell size={19} /><i /></button><span className="header-divider" /><button className="profile" aria-label="워크스페이스 설정" onClick={() => setSettings(true)}>SY</button></div></header>
      <main>
        <div className="page-title-row"><div><div className="eyebrow">CHEMICAL GROUP 2 <span>/</span> INTELLIGENCE WORKSPACE</div><h1 ref={pageHeading} tabIndex={-1}>{pageTitles[page]}<span className="title-dot">.</span></h1><p>{page === 'overview' ? '사업별 최근 뉴스, 수집 현황, 저장한 자료를 확인하세요.' : { map: '제품이 만들어지는 흐름 위에서 기업의 역할과 우리 사업의 기회를 찾으세요.', feed: '사업별 시장 신호를 살펴보고 의사결정의 근거를 쌓으세요.', watchlist: '놓치지 않아야 할 기업과 주제를 한곳에서 관리하세요.', brief: '한 주의 시장 신호를 기획팀을 위한 브리핑으로 정리하세요.', library: '저장한 인사이트와 직접 등록한 리서치 자료를 모아보세요.' }[page]}</p></div><div className="page-actions">
          {page === 'map' && <button className="btn secondary" onClick={() => navigate('feed')}><Radar size={17} />최신 뉴스</button>}
          <button className="btn secondary add-source" onClick={() => setAddOpen(true)}><Plus size={16} />자료 등록</button>
        </div></div>
        {page !== 'map' && <div className="scope-row"><div className="scope-tabs"><button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}><Globe2 size={15} />그룹 전체</button>{companies.map(c => <button key={c.id} className={scope === c.id ? 'active' : ''} onClick={() => setScope(c.id)}><span className={`small-dot ${c.id}`} />{c.shortName}</button>)}</div><span className="scope-caption"><ShieldCheck size={14} />출처 기반 인텔리전스</span></div>}

        {(savedError || sourcesError || topicsError || briefsError) && <div className="error" role="alert">브라우저 저장 공간에 기록할 수 없습니다. 현재 입력은 새로고침하면 사라질 수 있습니다. <button className="text-link" onClick={() => setSettings(true)}>설정에서 백업 내려받기 →</button></div>}
        {page === 'overview' && <Dashboard
          scope={scope}
          snapshot={news.snapshot}
          newsError={news.error}
          registered={sources}
          savedSignals={savedSignals}
          onNews={() => navigate('feed')}
          onMap={() => navigate('map')}
          onBrief={() => navigate('brief')}
          onAnalyze={() => analyze('현재 자료에서 기획팀이 우선 검토해야 할 시장 변화와 후속 조사 항목을 정리해줘')}
          onLibrary={tab => { setLibraryTab(tab); navigate('library'); }}
        />}

        {page === 'feed' && <div className="content-toolbar"><label className="search-field"><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="키워드, 경쟁사, 시장 신호 검색" aria-label="검색" />{query && <button aria-label="검색 지우기" onClick={() => setQuery('')}><X size={14} /></button>}</label><select aria-label="신호 유형" value={category} onChange={e => setCategory(e.target.value)}>{['전체', '기술·특허', '제품·시장', '투자·증설', '규제·정책'].map(v => <option key={v}>{v}</option>)}</select></div>}
        {page === 'feed' && <ResearchFeed scope={scope} query={query} category={category} signals={filteredSignals} renderSignal={signalCard} onRegister={registerResearch} onImport={importArticle} news={news} onRegisterSignal={registerNews} registeredSources={scopedSources} savedIds={savedIds} onToggleSaved={toggleSaved} />}
        {page === 'map' && <IndustryMap scope={scope} onScopeChange={setScope} onFeed={() => navigate('feed')} />}
        {page === 'watchlist' && <><div className="data-notice"><Bell size={17} /><span>관심 주제를 선택하면 관련 키워드를 확인할 수 있습니다. 관심 주제별 이메일 알림은 제공하지 않습니다.</span></div><div className="topic-grid">{watchTopics.filter(t => scope === 'all' || t.companyId === scope).map(t => <article className={`panel topic-card ${topics.includes(t.id) ? 'enabled' : ''}`} key={t.id}><div className="topic-heading"><span className={`company-label ${t.companyId}`}><span />{companyFor(t.companyId).shortName}</span><button className={`toggle ${topics.includes(t.id) ? 'on' : ''}`} role="switch" aria-checked={topics.includes(t.id)} aria-label={`${t.title} 관심 주제`} onClick={() => setTopics(old => old.includes(t.id) ? old.filter(x => x !== t.id) : [...old, t.id])}><span /></button></div><h3>{t.title}</h3><p>{t.description}</p><div className="signal-tags">{t.keywords.map(k => <span key={k}>{k}</span>)}</div><small>{topics.includes(t.id) ? '관심 주제로 설정됨' : '관심 주제 설정 안 됨'}</small></article>)}</div><div className="section-heading spaced"><h2>저장한 시장 신호 <span className="count-badge">{scopedSavedSignals.length}</span></h2></div><div className="feed-grid">{scopedSavedSignals.map(s => signalCard(s))}</div>{!scopedSavedSignals.length && <Empty text="아직 저장한 시장 신호가 없습니다." detail="시장 신호 카드의 북마크를 눌러 나만의 모니터링 리스트를 만들어 보세요." />}</>}
        {page === 'brief' && <WeeklyBrief signals={allSignals} scope={scope} legacyBriefs={briefs} />}
        {page === 'library' && <><div className="library-toolbar"><div className="scope-tabs"><button className={libraryTab === 'saved' ? 'active' : ''} onClick={() => setLibraryTab('saved')}>저장한 인사이트 <small>{scopedSavedSignals.length}</small></button><button className={libraryTab === 'sources' ? 'active' : ''} onClick={() => setLibraryTab('sources')}>등록한 자료 <small>{scopedSources.length}</small></button></div><button className="text-link" onClick={() => { const items = libraryItems; download('CHEM2-research.md', '# CHEM² Research Library\n\n' + (items.length ? items.map(s => `## ${s.title}\n${s.isDemo ? '[예시 시나리오]' : s.evidenceType === 'feed-metadata' ? '[RSS · 본문 미열람]' : '[사용자 등록 자료]'}\n${s.summary}\n${s.articleDetails ? Object.entries(s.articleDetails.notes).filter(([, value]) => value).map(([key, value]) => `\n${({ keyTakeaways: '핵심 논점', evidence: '근거·수치·조건', businessImpact: '사업 영향 · 사용자 분석', followUp: '후속 조사' } as Record<string, string>)[key]}: ${value}`).join('\n') : ''}\n\n출처: ${s.sourceName} ${s.sourceUrl}\n`).join('\n') : '저장된 자료가 없습니다.')); }}><ArrowDownToLine size={16} />Markdown 내보내기</button></div><div className="feed-grid">{libraryItems.map(s => <div key={s.id}>{signalCard(s)}{libraryTab === 'sources' && <button className="delete-source" onClick={() => { if (window.confirm('등록한 자료를 삭제할까요?')) { setSources(old => old.filter(x => x.id !== s.id)); setBookmarks(old => old.filter(entry => bookmarkId(entry) !== s.id)); setToast('자료를 삭제했습니다.'); } }}>등록 자료 삭제</button>}</div>)}</div>{!libraryItems.length && <Empty text={libraryTab === 'saved' ? '좋은 인사이트를 차곡차곡 모아보세요.' : '분석의 시작은 신뢰할 수 있는 자료입니다.'} detail={libraryTab === 'saved' ? '시장 신호에서 북마크한 자료가 이곳에 저장됩니다.' : '공식 발표·기사·리서치 내용을 원문 링크와 함께 등록해 보세요.'} action={libraryTab === 'sources' ? <button className="btn primary" onClick={() => setAddOpen(true)}><Plus size={16} />첫 자료 등록</button> : undefined} />}</>}
        <footer className="main-footer"><span>CHEM² INTELLIGENCE</span><p>Designed for a clearer perspective.</p><span>삼양사 화학2그룹 기획팀</span></footer>
      </main>
    </div>
    {page !== 'overview' && <button className="floating-ai" onClick={() => setAiOpen(true)}><Sparkles size={20} /><span>MI 어시스턴트</span><span className="ai-key">AI</span></button>}
    {toast && <div className="toast" role="status"><CheckCheck size={18} />{toast}</div>}
    {selected && <Modal title="시장 신호 상세" onClose={() => setSelected(null)} wide><div className="signal-detail"><div className="signal-top"><span className={`company-label ${selected.companyId}`}><span />{companyFor(selected.companyId).name}</span><span className="outline-badge">{selected.category}</span></div><h2>{selected.title}</h2><div className="detail-meta">{selected.sourceName} · {selected.date} · {selected.region}</div><div className="data-notice"><Compass size={18} /><span>{selected.isDemo ? '기능 시연을 위한 가상 시나리오입니다. 아래 공식 사이트 링크는 이 사건의 근거 기사가 아닙니다.' : selected.evidenceType === 'feed-metadata' ? '뉴스 피드의 제목·발행처·발행일·설명 메타데이터입니다. 기사 본문과 실제 발표일은 원문에서 별도로 확인해야 합니다. 사업·유형은 키워드 기준 분류입니다.' : '사용자가 입력한 자료이며 자동 사실 검증은 수행되지 않았습니다. 원문과 발표일을 확인해 주세요.'}</span></div><h3>신호 요약</h3><p>{selected.summary}</p><div className="implication-box"><h3><Sparkles size={17} />기획 관점의 검토 항목</h3><p>{selected.implication}</p></div>{selected.articleDetails && <><div className="source-import-meta">사용자 등록·분석 노트입니다. 원문의 사실 여부를 독립 검증하지 않았습니다.{selected.articleDetails.retrievedAt && <><br />원문 수집 시각: {selected.articleDetails.retrievedAt} (본문 수집 이력이며 사실 검증을 뜻하지 않습니다.)</>}</div>{([['핵심 논점', selected.articleDetails.notes.keyTakeaways], ['근거·수치·조건', selected.articleDetails.notes.evidence], ['사업 영향 · 사용자 분석', selected.articleDetails.notes.businessImpact], ['후속 조사', selected.articleDetails.notes.followUp]] as const).filter(([, value]) => value).map(([label, value]) => <section className="article-review-note" key={label}><h3>{label}</h3><p>{value}</p></section>)}{selected.articleDetails.sourceExcerpt && <details className="article-review-note"><summary>수집된 원문 본문 보기</summary><p>{selected.articleDetails.sourceExcerpt}</p></details>}</>}<div className="signal-tags">{selected.tags.map(t => <span key={t}>{t}</span>)}</div><div className="modal-actions"><a className="btn secondary" href={selected.sourceUrl} target="_blank" rel="noreferrer">{selected.isDemo ? '기업 공식 사이트' : '원문 확인'}<ExternalLink size={15} /></a><button className="btn primary" onClick={() => toggleSaved(selected)}>{savedIds.includes(selected.id) ? <Check size={16} /> : <Bookmark size={16} />}{savedIds.includes(selected.id) ? '저장됨' : '인사이트 저장'}</button></div></div></Modal>}
    {addOpen && <Modal title="리서치 자료 등록" onClose={() => setAddOpen(false)} wide><form onSubmit={addSource} className="source-form"><p className="muted">기사나 공식 발표의 핵심 내용을 입력하세요. URL만으로 본문을 수집하지 않습니다.</p><div className="form-row"><label>관련 사업<select name="company" defaultValue={articleDraft?.companyId || (scope === 'all' ? 'ncchem' : scope)}>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>유형<select name="category" defaultValue={articleDraft?.category}>{['제품·시장', '기술·특허', '투자·증설', '규제·정책'].map(c => <option key={c}>{c}</option>)}</select></label></div><label>제목<input name="title" defaultValue={articleDraft?.title} required maxLength={180} placeholder="예: 경쟁사 신규 소재 포트폴리오 발표" /></label><label>핵심 내용<textarea aria-label="핵심 내용" name="summary" defaultValue={articleDraft?.summary} required minLength={20} maxLength={4000} rows={4} placeholder="분석할 원문 내용이나 요약을 20자 이상 입력하세요." /></label><div className="form-row"><label>출처명<input name="sourceName" defaultValue={articleDraft?.sourceName} required maxLength={80} placeholder="공식 뉴스룸 / 매체명" /></label><label>대상 기업<input name="competitor" maxLength={100} placeholder="관련 경쟁사명" /></label></div><label>원문 URL<input name="url" defaultValue={articleDraft?.sourceUrl} type="url" pattern="https?://.*" required placeholder="https://" /></label><label>원문 발표일<input name="date" type="date" defaultValue={articleDraft ? articleDraft.date : todayInSeoul()} required /></label>{articleDraft?.sourceExcerpt && <div className="source-import-meta">수집된 원문 {articleDraft.sourceExcerpt.length.toLocaleString()}자 중 앞 4,000자를 요약·내용 칸에 불러왔습니다. 전체 수집 본문은 함께 보관합니다. 발표일이 비어 있으면 원문에서 확인해 입력하세요. 본문 수집은 사실 검증을 의미하지 않습니다.</div>}<fieldset><legend>심층 MI 분석 노트</legend><p className="notes-help">원문에 적힌 사실·수치와 담당자의 해석을 구분해서 남겨 주세요. 각 항목은 450자까지 입력할 수 있습니다.</p><label>핵심 논점<textarea aria-label="핵심 논점" name="keyTakeaways" defaultValue={articleDraft?.notes?.keyTakeaways} maxLength={450} rows={2} placeholder="기사에서 새롭게 제시한 주장이나 변화는 무엇인가요?" /></label><label>근거·수치·조건<textarea aria-label="근거·수치·조건" name="evidence" defaultValue={articleDraft?.notes?.evidence} maxLength={450} rows={3} placeholder="원문에 제시된 수치, 적용 조건, 발표자·문서 위치를 남겨 주세요." /></label><label>사업 영향 · 담당자 분석<textarea aria-label="사업 영향 · 담당자 분석" name="businessImpact" defaultValue={articleDraft?.notes?.businessImpact} maxLength={450} rows={3} placeholder="어떤 제품·고객·지역에 영향을 줄 수 있나요? 사실과 가설을 구분하세요." /></label><label>후속 조사<textarea aria-label="후속 조사" name="followUp" defaultValue={articleDraft?.notes?.followUp} maxLength={450} rows={3} placeholder="추가 확인할 원문, 담당자, 실험·고객 검증 항목은 무엇인가요?" /></label></fieldset><div className="detail-note">자료와 저장 목록은 이 브라우저에만 보관됩니다. 기밀·개인정보를 입력하지 마세요.</div><div className="modal-actions"><button type="button" className="btn secondary" onClick={() => setAddOpen(false)}>취소</button><button className="btn primary" type="submit"><Plus size={16} />자료 등록</button></div></form></Modal>}
    {aiOpen && <Modal title="MI 분석 어시스턴트" onClose={() => setAiOpen(false)} wide><div className="ai-panel"><div className="ai-panel-status"><span className="sparkle-tile"><Sparkles size={20} /></span><div><strong>시장에서 전략으로, 함께 생각합니다.</strong><p>{mode === 'llm' ? '연결된 LLM으로 등록 자료를 분석합니다.' : '로컬 모드 · 등록 자료를 정해진 규칙으로 요약합니다.'}</p></div></div><div className="data-notice"><ShieldCheck size={17} /><span>분석 범위: {activeCompany?.name || '화학2그룹 전체'} · 최근 {analysisSignals.length}건 (응답당 최대 6건 참조). 실시간 웹 검색을 수행하지 않으며 예시 자료가 포함됩니다.{mode === 'llm' && ' 질문과 자료가 설정된 LLM 제공자로 전송됩니다.'}</span></div>{!aiResult && !aiBusy && !aiError && <div className="suggested-questions">{['경쟁사 동향에서 우선 확인할 항목은?', '사업별 시장 신호와 기획 시사점을 정리해줘', '다음 주 모니터링할 키워드를 추천해줘'].map(q => <button key={q} onClick={() => analyze(q)}>{q}<ArrowUpRight size={15} /></button>)}</div>}{aiBusy && <div className="ai-loading"><LoaderCircle className="spin" size={25} /><p>자료와 출처를 정리하고 있습니다…</p></div>}{aiError && <div className="error" role="alert">{aiError}</div>}{aiResult && <div className="ai-response"><span className="outline-badge">{aiResult.mode === 'llm' ? 'LLM 분석' : '로컬 근거 요약'}</span><div className="report-text">{aiResult.answer}</div><div className="citation-links">{aiResult.citations.map(id => { const s = allSignals.find(item => item.id === id); return s ? <a key={id} href={s.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={11} />{s.sourceName}</a> : null; })}</div><button className="text-link" onClick={() => download('CHEM2-analysis.md', aiResult.answer)}><ArrowDownToLine size={15} />분석 저장</button></div>}<form className="ai-input" onSubmit={e => { e.preventDefault(); analyze(); }}><input aria-label="MI 분석 질문" placeholder="기획 관점에서 궁금한 내용을 질문하세요" value={aiQuestion} maxLength={2000} onChange={e => setAiQuestion(e.target.value)} /><button type="submit" disabled={aiBusy || !aiQuestion.trim()} aria-label="분석 요청"><Send size={18} /></button></form></div></Modal>}
    {settings && <Modal title="워크스페이스 설정" onClose={() => setSettings(false)}><div className="settings-content"><span className="settings-status"><span className="status-dot" />{mode === 'llm' ? 'LLM 설정 모드' : '로컬 분석 모드'}</span><h3>AI 연결</h3>{hosting === 'static' && <div className="data-notice">현재 정적 웹사이트입니다. 로컬 분석·브리핑은 브라우저에서 작동합니다. 생성형 AI를 사용하려면 이 프로젝트의 API 서버를 별도로 실행하고 연결해야 합니다.</div>}<p>현재 {mode === 'llm' ? '서버에 구성된 LLM을 사용합니다.' : 'API 키 없이 규칙 기반 요약을 사용할 수 있습니다.'} 생성형 AI를 사용하려면 서버 환경에 다음 변수를 설정하고 서버를 다시 시작하세요.</p><code>MI_LLM_API_KEY<br />MI_LLM_MODEL (선택)<br />MI_LLM_BASE_URL (선택)</code><p className="detail-note">키는 서버에서만 보관합니다. 실제 키를 브라우저나 채팅에 입력하지 마세요. LLM 모드에서는 질문과 선택한 자료가 해당 제공자에게 전송됩니다.</p><h3>데이터 보관</h3><p>관심 주제, 등록 자료, 북마크, 브리핑은 이 브라우저의 로컬 저장소에 저장됩니다. 공개 뉴스 수집은 브라우저의 등록 자료나 북마크에 접근하지 않습니다.</p><button className="btn secondary" onClick={() => { download('CHEM2-workspace-backup.json', JSON.stringify({ version: 1, sources, saved: savedIds, savedNews: bookmarks.filter(isStoredNews), topics, briefs }, null, 2), 'application/json;charset=utf-8'); setToast('워크스페이스 백업을 내려받았습니다.'); }}><ArrowDownToLine size={16} />워크스페이스 백업</button></div></Modal>}
    {help && <Modal title="CHEM² 워크스페이스 가이드" onClose={() => setHelp(false)}><div className="guide"><p>삼양사 화학2그룹 기획팀의 경쟁시장 MI를 위한 첫 번째 워크스페이스입니다.</p>{[['01', '시장의 구조를 파악하세요', '산업 지도에서 삼양엔씨켐·삼양KCI·Verdant의 공정과 전후방 기업을 탐색합니다. 공정별 기업 카드를 누르면 사업의 역할과 일반적인 수익 구조를 확인할 수 있습니다.'], ['02', '신뢰할 수 있는 근거를 모으세요', '자료 등록으로 원문 내용과 출처를 입력하고, 필요한 시장 신호를 북마크합니다. 기본 신호는 모두 가상 예시입니다.'], ['03', '브리핑으로 다음 액션을 정하세요', '사업 필터를 선택하고 브리핑을 생성합니다. 로컬 요약 또는 서버에 연결된 LLM을 사용하며 결과는 Markdown으로 내보낼 수 있습니다.']].map(([n, t, p]) => <div key={n}><span>{n}</span><section><h3>{t}</h3><p>{p}</p></section></div>)}<div className="detail-note">공개 RSS 뉴스는 정기적으로 수집합니다. 기사 원문과 사업 영향은 별도로 확인해 주세요.</div></div></Modal>}
    {notifications && <Modal title="워크스페이스 알림" onClose={() => setNotifications(false)}><div className="notification-content"><span className="sparkle-tile"><Bell size={22} /></span><h3>인텔리전스 워크스페이스를 시작합니다.</h3><p>현재 예시 시나리오 {seedSignals.length}건으로 화면과 분석 흐름을 살펴볼 수 있습니다. 실제 시장 자료를 등록하면 분석과 브리핑에 함께 반영됩니다.</p><div className="detail-note">실시간 알림 서비스는 연결되지 않았습니다.</div><button className="btn primary" onClick={() => { setNotifications(false); setAddOpen(true); }}>실제 자료 등록<Plus size={16} /></button></div></Modal>}
  </div>;
}

function Empty({ text, detail, action }: { text: string; detail?: string; action?: ReactNode }) { return <div className="empty"><FolderOpen size={32} /><h3>{text}</h3>{detail && <p>{detail}</p>}{action}</div>; }
