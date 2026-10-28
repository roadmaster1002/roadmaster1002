import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowRight, BookOpen, Check, Clock3, ExternalLink, FileUp, Link2, Plus, ShieldCheck, X } from 'lucide-react';
import { companies, type CompanyId, type Signal } from './data';
import { researchItems, type ResearchItem } from './researchData';
import './research-feed.css';
import LatestNews from './LatestNews';
import type { NewsSnapshot } from './newsClient';

type Props = {
  scope: CompanyId | 'all';
  query: string;
  category: string;
  signals: Signal[];
  renderSignal: (signal: Signal) => ReactNode;
  onRegister: (item?: ResearchItem) => void;
  onImport: (value: unknown) => void;
  news: { snapshot: NewsSnapshot; loading: boolean; error: string; refresh: () => void };
  onRegisterSignal: (signal: Signal) => void;
};

function exportGuide(item: ResearchItem) {
  const text = `# ${item.title}\n\n상태: 리딩 후보 · 원문 미열람/미검증\n발행처: ${item.publisher}\n자료 기준: ${item.referenceLabel}\n원문: ${item.url}\n\n## 왜 읽어야 하나\n${item.whyRead}\n\n## 기획 관점의 검토 질문 (기사에서 추출한 결론이 아닙니다)\n${item.businessLens.map(s => `### ${s.heading}\n${s.body}`).join('\n\n')}\n\n## 원문에서 확인할 항목\n${item.readingQuestions.map(s => `- ${s}`).join('\n')}\n\n## 확보할 근거\n${item.evidenceNeeded.map(s => `- ${s}`).join('\n')}\n\n유의: ${item.caution}\n`;
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = `${item.id}-reading-guide.md`; a.click(); URL.revokeObjectURL(url);
}

export default function ResearchFeed({ scope, query, category, signals, renderSignal, onRegister, onImport, news, onRegisterSignal }: Props) {
  const [tab, setTab] = useState<'latest' | 'reading' | 'articles' | 'examples'>('latest');
  const [selected, setSelected] = useState<ResearchItem | null>(null);
  const [copied, setCopied] = useState('');
  const [importError, setImportError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const items = researchItems.filter(item => (scope === 'all' || item.companyId === scope) && `${item.title} ${item.publisher} ${item.topic} ${item.whyRead}`.toLowerCase().includes(query.toLowerCase()) && (category === '전체' || (category === '규제·정책' ? item.kind === '규제 원문' : category === '기술·특허' ? item.kind === '기술 기사' || item.kind === '공식 발표' : item.kind === '연차보고서')));
  const articles = signals.filter(s => !s.isDemo && s.evidenceType !== 'feed-metadata');
  const examples = signals.filter(s => s.isDemo);
  useEffect(() => { if (selected) dialog.current?.showModal(); }, [selected]);
  useEffect(() => { if (!copied) return; const t = setTimeout(() => setCopied(''), 2000); return () => clearTimeout(t); }, [copied]);
  function close() { dialog.current?.close(); setSelected(null); }
  async function copyLink(item: ResearchItem) {
    try { await navigator.clipboard.writeText(item.url); setCopied(item.id); } catch { setSelected(item); }
  }
  async function importFile(file?: File) {
    if (!file) return;
    setImportError('');
    try {
      if (file.size > 500_000) throw new Error('500KB 이하의 기사 JSON 파일을 선택해 주세요.');
      onImport(JSON.parse(await file.text())); setTab('articles');
    } catch (e) { setImportError(e instanceof Error ? e.message : '기사 파일을 확인해 주세요.'); }
    if (fileInput.current) fileInput.current.value = '';
  }
  return <section className="research-workspace">
    <div className="research-intro"><div><span className="research-eyebrow">FROM ARTICLES TO DECISIONS</span><h2>기사에서 사업의 시사점까지</h2><p>기술·경쟁사·규제를 원문과 함께 읽고, 핵심 근거와 후속 과제를 정리합니다.</p></div><div className="research-intro-mark"><BookOpen size={31} /><span>DEEP<br />READING</span></div></div>
    {tab === 'reading' && <div className="research-status"><span><strong>{items.length}</strong>리딩 후보</span><span><strong>{articles.length}</strong>등록 기사·자료</span><span><Clock3 size={17} />추천 원문 열람 확인 대기</span></div>}
    {tab === 'reading' && <div className="data-notice research-access-note"><ShieldCheck size={20} /><div><strong>기사와 분석의 근거를 구분합니다.</strong><p>현재 외부 원문 접근이 차단되어 아래 자료는 <b>원문 미검증 리딩 후보</b>입니다. 리딩 가이드는 기획 관점의 조사 질문이며, 기사를 읽고 추출한 사실·요약이 아닙니다. 최신성·현행 규정은 원문에서 확인해 주세요.</p></div></div>}
    <div className="research-toolbar"><div className="research-tabs" role="group" aria-label="MI 자료 보기"><button aria-pressed={tab === 'latest'} className={tab === 'latest' ? 'active' : ''} onClick={() => setTab('latest')}>최신 뉴스</button><button aria-pressed={tab === 'reading'} className={tab === 'reading' ? 'active' : ''} onClick={() => setTab('reading')}>배경 리딩 <span>{items.length}</span></button><button aria-pressed={tab === 'articles'} className={tab === 'articles' ? 'active' : ''} onClick={() => setTab('articles')}>등록한 기사 <span>{articles.length}</span></button><button aria-pressed={tab === 'examples'} className={tab === 'examples' ? 'active' : ''} onClick={() => setTab('examples')}>기능 예시 <span>{examples.length}</span></button></div><button className="btn secondary" onClick={() => fileInput.current?.click()}><FileUp size={17} />기사 JSON 가져오기</button><input className="research-file-input" ref={fileInput} type="file" accept="application/json,.json" aria-label="기사 JSON 파일" onChange={e => importFile(e.target.files?.[0])} /></div>
    {importError && <div className="error" role="alert">{importError}</div>}
    {tab === 'latest' && <LatestNews snapshot={news.snapshot} loading={news.loading} error={news.error} refresh={news.refresh} scope={scope} query={query} category={category} registered={articles} onRegister={onRegisterSignal} />}
    {tab === 'reading' && <><div className="research-grid">{items.map(item => <article className="research-card" key={item.id}><div className="research-card-meta"><span className={`company-label ${item.companyId}`}><span />{companies.find(c => c.id === item.companyId)?.name}</span><span>{item.kind}</span></div><div className="research-reference"><span>{item.publisher}</span><span>{item.referenceLabel}</span></div><button className="research-card-title" onClick={() => setSelected(item)}><h3>{item.title}</h3><ArrowRight size={20} /></button><div className="research-topic">{item.topic}</div><p className="research-why">{item.whyRead}</p><div className="research-question-preview"><span>원문에서 확인할 질문</span><p>{item.readingQuestions[0]}</p></div><div className="research-card-footer"><span><Clock3 size={14} />원문 미검증</span><button className="text-link" onClick={() => setSelected(item)}>리딩 가이드<BookOpen size={16} /></button></div><div className="research-card-actions"><a href={item.url} target="_blank" rel="noreferrer">원문 열기<ExternalLink size={16} /></a><button onClick={() => copyLink(item)}>{copied === item.id ? <Check size={16} /> : <Link2 size={16} />}{copied === item.id ? '복사됨' : '링크 복사'}</button></div></article>)}</div>{!items.length && <div className="research-empty"><BookOpen size={34} /><h3>조건에 맞는 리딩 후보가 없습니다.</h3><p>사업·유형 필터나 검색어를 변경해 주세요.</p></div>}</>}
    {tab === 'articles' && <><div className="research-reading-note"><BookOpen size={20} /><p>원문 내용과 <strong>핵심 근거·사업 영향·후속 조사</strong>를 함께 등록하세요. 등록 자료는 분석 도우미와 주간 브리핑에서 사용할 수 있습니다.</p></div><div className="feed-grid">{articles.map(renderSignal)}</div>{!articles.length && <div className="research-empty"><BookOpen size={34} /><h3>실제 기사 내용을 등록해 주세요.</h3><p>현재 수집·등록된 실제 기사 원문이 없습니다.<br />추천 원문을 읽은 뒤 내용을 등록하거나 수집한 기사 JSON을 가져올 수 있습니다.</p><button className="btn primary" onClick={() => onRegister()}><Plus size={17} />기사·분석 노트 등록</button></div>}</>}
    {tab === 'examples' && <><div className="data-notice">아래 시나리오는 기능 확인용 예시이며 실제 기사나 시장 조사 결과가 아닙니다.</div><div className="feed-grid">{examples.map(renderSignal)}</div>{!examples.length && <div className="research-empty"><p>선택 조건의 기능 예시가 없습니다.</p></div>}</>}
    {selected && <dialog className="modal research-dialog" ref={dialog} aria-labelledby={titleId} onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }}><div className="modal-header"><h2>심층 리딩 가이드</h2><button className="icon-btn" aria-label="리딩 가이드 닫기" onClick={close}><X size={22} /></button></div><div className="research-reader"><div className="research-reader-meta"><span>{selected.kind} · {selected.publisher}</span><span>원문 미검증</span></div><h2 id={titleId}>{selected.title}</h2><p className="research-reader-reference">{selected.referenceLabel}</p><div className="research-reader-source"><a href={selected.url} target="_blank" rel="noreferrer">원문에서 근거 확인<ExternalLink size={17} /></a><button onClick={() => copyLink(selected)}><Link2 size={16} />{copied === selected.id ? '링크 복사됨' : '링크 복사'}</button></div><div className="data-notice">아래 내용은 원문에서 추출한 기사 요약이 아닌, 검토를 위한 기획팀 리딩 가이드입니다.</div><section><span className="research-section-number">01 / WHY IT MATTERS</span><h3>왜 읽어야 하나</h3><p>{selected.whyRead}</p></section><section><span className="research-section-number">02 / BUSINESS LENS</span><h3>우리 사업에 연결할 질문</h3>{selected.businessLens.map(lens => <div className="research-lens" key={lens.heading}><h4>{lens.heading}</h4><p>{lens.body}</p></div>)}</section><section><span className="research-section-number">03 / READ FOR EVIDENCE</span><h3>원문에서 확인할 항목</h3><ol>{selected.readingQuestions.map(q => <li key={q}>{q}</li>)}</ol></section><section><span className="research-section-number">04 / FOLLOW-UP</span><h3>추가로 확보할 근거</h3><ul>{selected.evidenceNeeded.map(q => <li key={q}>{q}</li>)}</ul></section><div className="research-caution"><ShieldCheck size={19} /><p>{selected.caution}</p></div><div className="research-reader-footer"><button className="btn secondary" onClick={() => exportGuide(selected)}><ArrowDownToLine size={17} />가이드 내보내기</button><button className="btn primary" onClick={() => { const item = selected; close(); onRegister(item); }}><Plus size={17} />읽은 내용 등록</button></div></div></dialog>}
  </section>;
}
