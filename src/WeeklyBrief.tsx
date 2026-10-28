import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, CalendarDays, Check, ChevronDown, FileText, History, Printer, ShieldCheck } from 'lucide-react';
import { buildWeeklyBrief, weeklyBriefToMarkdown, type WeeklyBrief as Report, type WeeklyBriefAction } from '../shared/weekly-brief.mjs';
import { companies, type CompanyId, type Signal } from './data';
import './weekly-brief.css';

type LegacyBrief = { date: string; text: string; scope: string; mode: string };
type StoredReport = { version: 2; id: string; report: Report };
type Props = { signals: Signal[]; scope: CompanyId | 'all'; legacyBriefs?: LegacyBrief[] };
const STORAGE_KEY = 'chem2-weekly-v2';
const statuses: WeeklyBriefAction['status'][] = ['미착수', '진행 중', '완료'];
const seoulToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const offsetDate = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
const inPeriod = (s: Signal, start: string, end: string) => s.date && s.date >= start && s.date <= end;
const companyLabel = (id: string) => companies.find(c => c.id === id)?.name || '화학2그룹 전체';
function belongsTo(s: Signal, scope: CompanyId | 'all') { const related = (s as Signal & { companyIds?: CompanyId[] }).companyIds; return scope === 'all' || s.companyId === scope || related?.includes(scope); }
function download(filename: string, content: string, mime = 'text/markdown;charset=utf-8') { const url = URL.createObjectURL(new Blob([content], { type: mime })); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
const stringList = (v: unknown) => Array.isArray(v) && v.every(x => typeof x === 'string');
function validReport(v: unknown): v is Report {
  if (!v || typeof v !== 'object') return false;
  const b = v as Report;
  return !!b.period && typeof b.period.start === 'string' && validDate(b.period.start) && typeof b.period.end === 'string' && validDate(b.period.end)
    && !!b.previousPeriod && typeof b.previousPeriod.start === 'string' && typeof b.previousPeriod.end === 'string'
    && ['all', 'ncchem', 'kci', 'verdant'].includes(b.scope) && !!b.coverage && typeof b.coverage.currentCount === 'number' && typeof b.coverage.previousCount === 'number'
    && stringList(b.executiveSummary) && stringList(b.limitations) && Array.isArray(b.topChanges) && b.topChanges.every(x => x && typeof x.id === 'string' && typeof x.title === 'string' && typeof x.summary === 'string' && typeof x.implication === 'string')
    && Array.isArray(b.businesses) && b.businesses.every(x => x && typeof x.label === 'string' && stringList(x.observations) && stringList(x.implications))
    && Array.isArray(b.actionItems) && b.actionItems.every(x => x && typeof x.id === 'string' && typeof x.task === 'string' && typeof x.owner === 'string' && statuses.includes(x.status) && stringList(x.evidenceIds))
    && Array.isArray(b.sources) && b.sources.every(x => x && typeof x.id === 'string' && typeof x.title === 'string' && typeof x.sourceName === 'string' && typeof x.sourceUrl === 'string');
}
function storedReports(): StoredReport[] { try { const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(parsed) ? parsed.filter((x): x is StoredReport => !!x && x.version === 2 && typeof x.id === 'string' && validReport(x.report)).slice(0, 20) : []; } catch { return []; } }

export default function WeeklyBrief({ signals, scope, legacyBriefs = [] }: Props) {
  const [start, setStart] = useState(() => offsetDate(seoulToday(), -6));
  const [end, setEnd] = useState(seoulToday);
  const [includeExamples, setIncludeExamples] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [history, setHistory] = useState<StoredReport[]>(storedReports);
  const [activeId, setActiveId] = useState(() => storedReports()[0]?.id || '');
  const [storageError, setStorageError] = useState(false);
  const [error, setError] = useState('');
  const validPeriod = validDate(start) && validDate(end) && start <= end;
  const days = validPeriod ? (Date.parse(end) - Date.parse(start)) / 86400000 + 1 : 0;
  const previousPeriod = validPeriod ? { start: offsetDate(start, -days), end: offsetDate(start, -1) } : null;
  const candidates = useMemo(() => signals.filter(s => belongsTo(s, scope) && inPeriod(s, start, end) && (includeExamples || !s.isDemo)), [signals, scope, start, end, includeExamples]);
  const candidateKey = candidates.map(s => s.id).join('|');
  const excludedExamples = signals.filter(s => belongsTo(s, scope) && inPeriod(s, start, end) && s.isDemo).length;
  const previousCount = previousPeriod ? signals.filter(s => belongsTo(s, scope) && inPeriod(s, previousPeriod.start, previousPeriod.end) && (includeExamples || !s.isDemo)).length : 0;
  const current = history.find(item => item.id === activeId);
  const report = current?.report;
  useEffect(() => { setSelectedIds(candidates.map(s => s.id)); }, [candidateKey, scope, start, end, includeExamples]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 20))); setStorageError(false); } catch { setStorageError(true); } }, [history]);
  function preset(kind: 'recent' | 'current' | 'previous') {
    const today = seoulToday(); const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; const monday = offsetDate(today, -weekday);
    setStart(kind === 'recent' ? offsetDate(today, -6) : kind === 'current' ? monday : offsetDate(monday, -7));
    setEnd(kind === 'previous' ? offsetDate(monday, -1) : today); setError('');
  }
  function generate() {
    setError('');
    try {
      if (!validPeriod || !previousPeriod) throw new Error('올바른 분석 시작일과 종료일을 선택하세요.');
      if (end > seoulToday()) throw new Error('미래 날짜는 주간 실적·동향 브리핑의 분석 기간에 포함할 수 없습니다.');
      const chosen = new Set(selectedIds);
      // Keep all prior-period records even when current-period checkboxes change.
      const inputs = signals.filter(s => (inPeriod(s, start, end) && chosen.has(s.id)) || inPeriod(s, previousPeriod.start, previousPeriod.end));
      const result = buildWeeklyBrief({ signals: inputs, company: scope, period: { start, end }, includeExamples, asOfISO: new Date().toISOString() });
      const id = `weekly-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setHistory(old => [{ version: 2, id, report: result }, ...old].slice(0, 20) as StoredReport[]); setActiveId(id);
    } catch (e) { setError(e instanceof Error ? e.message : '브리핑을 생성하지 못했습니다.'); }
  }
  function updateReport(update: (brief: Report) => Report) { if (!current) return; setHistory(old => old.map(item => item.id === current.id ? { ...item, report: update(item.report) } : item)); }
  function updateAction(id: string, update: Partial<WeeklyBriefAction>) { updateReport(b => ({ ...b, actionItems: b.actionItems.map(a => a.id === id ? { ...a, ...update } : a) })); }
  function exportActions() {
    if (!report) return;
    const cell = (value: string) => `"${(/^[=+\-@\t\r]/.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`;
    const rows = [['사업', '할 일', '근거', '원문 URL', '담당', '기한', '상태'], ...report.actionItems.map(a => [companyLabel(a.companyId), a.task, a.evidenceIds.join(', '), a.evidenceIds.map(id => report.sources.find(source => source.id === id)?.sourceUrl || '').filter(Boolean).join(' | '), a.owner, a.dueDate || '', a.status])];
    download(`MI-actions-${report.period.end}.csv`, '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  }
  return <div className="weekly-workspace">
    <section className="weekly-controls panel">
      <div className="weekly-control-heading"><span><CalendarDays size={21} />주간 브리핑 준비</span><small>로컬 근거 정리 · 생성형 AI 추론 아님</small></div>
      <div className="weekly-period-presets" role="group" aria-label="브리핑 기간 빠른 선택"><button onClick={() => preset('recent')}>최근 7일</button><button onClick={() => preset('current')}>이번 주</button><button onClick={() => preset('previous')}>지난주</button></div>
      <div className="weekly-filter-row"><label>분석 시작일<input type="date" value={start} max={end || undefined} onChange={e => setStart(e.target.value)} /></label><label>분석 종료일<input type="date" value={end} min={start || undefined} max={seoulToday()} onChange={e => setEnd(e.target.value)} /></label><div><span>분석 범위</span><strong>{companyLabel(scope)}</strong></div><button className="btn primary" onClick={generate}><FileText size={18} />주간 브리핑 생성</button></div>
      <div className="weekly-example-row"><label><input type="checkbox" checked={includeExamples} onChange={e => setIncludeExamples(e.target.checked)} />기능 예시 시나리오 포함</label><span>기본은 뉴스 메타데이터와 실제 등록 자료를 사용합니다.{excludedExamples > 0 && ` 기간 내 예시 ${excludedExamples}건은 ${includeExamples ? '포함됩니다' : '제외됩니다'}.`}</span></div>
      {error && <p className="weekly-warning" role="alert">{error}</p>}
      <details className="weekly-source-selection"><summary>참조 자료 선택 <strong>{selectedIds.length} / {candidates.length}건</strong><ChevronDown size={17} /></summary><p>체크한 이번 기간 자료로 작성합니다. 비교 기간({previousPeriod ? `${previousPeriod.start} ~ ${previousPeriod.end}` : '날짜 선택 필요'}) 자료 {previousCount}건은 선택과 관계없이 비교에 유지됩니다. 중복 제거 후 실제 건수는 결과에서 확인하세요.</p><div className="weekly-selection-buttons"><button onClick={() => setSelectedIds(candidates.map(s => s.id))}>전체 선택</button><button onClick={() => setSelectedIds([])}>선택 해제</button></div>{candidates.length ? <div className="weekly-source-checklist">{candidates.map(s => <label key={s.id}><input type="checkbox" checked={selectedIds.includes(s.id)} onChange={e => setSelectedIds(old => e.target.checked ? [...old, s.id] : old.filter(id => id !== s.id))} /><span><strong>{s.title}</strong><small>{companyLabel(s.companyId)} · {s.date} · {s.sourceName}{s.isDemo ? ' · 기능 예시' : ''}</small></span></label>)}</div> : <div className="weekly-no-sources">선택 기간에 사용할 등록 자료가 없습니다. 원문과 발표일이 있는 자료를 추가하거나 기간을 변경하세요. 자료 공백 보고서는 생성할 수 있습니다.</div>}</details>
    </section>
    {storageError && <div className="weekly-warning" role="alert">브라우저 저장 공간에 기록하지 못했습니다. 새로고침 전에 Markdown으로 내려받아 보관하세요.</div>}
    <div className="weekly-history-toolbar"><label><History size={18} />저장된 브리핑<select aria-label="저장된 주간 브리핑" value={activeId} onChange={e => setActiveId(e.target.value)}><option value="">브리핑 선택</option>{history.map(item => <option key={item.id} value={item.id}>{item.report.period.start} ~ {item.report.period.end} · {companyLabel(item.report.scope)}</option>)}</select></label><span>이 브라우저에 최근 20개 보관</span></div>
    {report ? <article className="weekly-report panel">
      <div className="weekly-report-toolbar"><span><ShieldCheck size={18} />입력 근거에 한정한 구조화 초안</span><div><button onClick={() => download(`MI-weekly-${report.period.end}.md`, weeklyBriefToMarkdown(report))}><ArrowDownToLine size={17} />Markdown 내보내기</button><button onClick={() => window.print()}><Printer size={17} />인쇄 / PDF</button></div></div>
      <header className="weekly-report-heading"><span>CHEMICAL GROUP 2 · WEEKLY INTELLIGENCE</span><h2>경쟁시장 주간 브리핑</h2><p>{report.period.start} — {report.period.end} · {companyLabel(report.scope)}</p><small>비교 기간 {report.previousPeriod.start} — {report.previousPeriod.end} · {report.generatedAt ? `생성 ${new Date(report.generatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}` : '생성 시각 없음'}</small></header>
      <section className="weekly-report-section"><h3><span>01</span>핵심 요약</h3><ul className="weekly-executive">{report.executiveSummary.map(text => <li key={text}>{text}</li>)}</ul></section>
      <section className="weekly-report-section"><h3><span>02</span>근거 범위와 비교 가능성</h3><div className="weekly-coverage-grid"><div><span>이번 기간 자료</span><strong>{report.coverage.currentCount}<small>건</small></strong><p>중복 제거 후 실제 검토 기록</p></div><div><span>비교 기간 자료</span><strong>{report.coverage.previousCount}<small>건</small></strong><p>{report.coverage.previousCount ? '같은 길이의 직전 기간 기록' : '전기 자료 없음 · 변화 비교 불가'}</p></div><div><span>발행처 / 출처 호스트</span><strong>{report.coverage.sourceCount}<small>곳</small></strong><p>자료 수는 시장 전체 기사 수가 아닙니다.</p></div></div><p className="weekly-coverage-note">RSS 메타데이터 {report.coverage.feedMetadataCount}건 · 날짜 미등록 {report.coverage.undatedCount}건 · 중복 제외 {report.coverage.duplicateCount}건{report.coverage.truncatedCount > 0 && ` · 처리 한도로 제외 ${report.coverage.truncatedCount}건`}. 자료가 없다는 이유로 시장 변화가 없었다고 판단하지 않습니다.</p></section>
      <section className="weekly-report-section"><h3><span>03</span>우선 검토할 변화 <small>최대 5건 · 등록 우선도 / 발표일 기준</small></h3>{report.topChanges.length ? <div className="weekly-changes">{report.topChanges.map((change, index) => <article key={change.id}><div className="weekly-change-meta"><span>{String(index + 1).padStart(2, '0')}</span><span>{companyLabel(change.companyId)} · {change.date}</span><span>{change.isDemo ? '기능 예시' : change.evidenceType === 'feed-metadata' ? 'RSS · 본문 미열람' : '등록 자료'}</span><span>기록 대조: {change.comparison}</span></div><h4>{change.title}</h4><dl><dt>{change.evidenceType === 'feed-metadata' ? 'RSS 메타데이터' : '등록된 관찰'}</dt><dd>{change.summary || '요약 미등록 — 원문 확인 필요'}</dd><dt>담당자 해석 / 검토 사항</dt><dd>{change.implication || '사업 영향 노트를 추가하고 적용 제품·고객·지역을 확인하세요.'}</dd></dl><a href={`#weekly-source-${encodeURIComponent(change.id)}`}>근거 [{change.id}] · {change.sourceName}</a></article>)}</div> : <p className="weekly-gap">선택 기간의 근거 자료가 없어 핵심 변화를 작성하지 않았습니다. 자료 확보가 먼저 필요합니다.</p>}</section>
      <section className="weekly-report-section"><h3><span>04</span>사업별 관찰과 자료 공백</h3><div className="weekly-business-grid">{report.businesses.map(b => { const outOfScope = report.scope !== 'all' && report.scope !== b.companyId; return <article key={b.companyId}><div><span className={`small-dot ${b.companyId}`} /><h4>{b.label}</h4><small>{outOfScope ? '범위 외' : b.status}</small></div><p className="weekly-business-count">{b.signalCount}건 · 발행처/출처 {b.sourceCount}곳</p>{outOfScope ? <p>이번 브리핑의 분석 범위에 포함되지 않았습니다.</p> : <><h5>관찰</h5><ul>{b.observations.map(t => <li key={t}>{t}</li>)}</ul><h5>검토 사항</h5><ul>{b.implications.map(t => <li key={t}>{t}</li>)}</ul></>}</article>; })}</div></section>
      <section className="weekly-report-section"><div className="weekly-actions-heading"><h3><span>05</span>후속 액션</h3><button onClick={exportActions} disabled={!report.actionItems.length}><ArrowDownToLine size={16} />액션 CSV</button></div><p className="weekly-coverage-note">담당·기한·상태는 기획팀이 직접 입력합니다. 자동으로 담당자를 배정하거나 완료로 처리하지 않습니다.</p>{report.actionItems.length ? <div className="weekly-action-scroll"><table><thead><tr><th>사업 / 할 일</th><th>담당</th><th>기한</th><th>상태</th></tr></thead><tbody>{report.actionItems.map(a => <tr key={a.id}><td><strong>{companyLabel(a.companyId)}</strong><p>{a.task}</p><small>근거 {a.evidenceIds.map(id => `[${id}]`).join(', ')}</small></td><td><input aria-label={`${a.id} 담당`} value={a.owner} maxLength={80} onChange={e => updateAction(a.id, { owner: e.target.value })} /><span className="weekly-print-value">{a.owner || '미지정'}</span></td><td><input aria-label={`${a.id} 기한`} type="date" value={a.dueDate || ''} onChange={e => updateAction(a.id, { dueDate: e.target.value || null })} /><span className="weekly-print-value">{a.dueDate || '미정'}</span></td><td><select aria-label={`${a.id} 상태`} value={a.status} onChange={e => updateAction(a.id, { status: e.target.value as WeeklyBriefAction['status'] })}>{statuses.map(status => <option key={status}>{status}</option>)}</select><span className="weekly-print-value">{a.status}</span></td></tr>)}</tbody></table></div> : <p className="weekly-gap">기간 내 원문 자료를 확보한 뒤 구체적인 액션을 정하세요. 아직 자동으로 만든 수행 과제는 없습니다.</p>}</section>
      <section className="weekly-report-section"><h3><span>06</span>회의 메모</h3><textarea className="weekly-meeting-notes" aria-label="주간 브리핑 회의 메모" value={report.meetingNotes || ''} onChange={e => updateReport(b => ({ ...b, meetingNotes: e.target.value }))} maxLength={12000} rows={4} placeholder="회의에서 확인한 사실, 미확인 가설, 추가 요청을 구분해 남기세요." /><p className="weekly-print-value weekly-notes-print">{report.meetingNotes || '회의 메모 없음'}</p></section>
      <section className="weekly-report-section"><h3><span>07</span>원문 근거와 한계</h3>{report.sources.length ? <ol className="weekly-sources">{report.sources.map(source => <li key={source.id} id={`weekly-source-${encodeURIComponent(source.id)}`}><strong>[{source.id}] {source.title}</strong><p>{source.sourceName} · {source.date} · {source.isDemo ? '기능 예시 — 실제 기사 아님' : source.evidenceType === 'feed-metadata' ? 'RSS 메타데이터 — 본문 미열람' : '등록 자료 — 독립 사실 검증 안 됨'}</p>{source.sourceUrl && <a href={source.sourceUrl} target="_blank" rel="noreferrer">{source.sourceUrl}</a>}</li>)}</ol> : <p className="weekly-gap">이번 기간에 인용할 자료가 없습니다.</p>}<ul className="weekly-limitations">{report.limitations.map(t => <li key={t}>{t}</li>)}</ul></section>
    </article> : <section className="weekly-start panel"><FileText size={42} /><h2>근거에서 회의 안건으로.</h2><p>기간과 자료를 선택하고 ‘주간 브리핑 생성’을 누르세요.<br />요약·사업별 시사점·근거·후속 액션을 하나의 보고서로 정리합니다.</p><small>자료가 없어도 공백과 다음 확인 과제를 명시한 보고서를 만들 수 있습니다.</small></section>}
    {legacyBriefs.length > 0 && <details className="weekly-legacy panel"><summary><History size={17} />이전 형식 브리핑 {legacyBriefs.length}개 · 읽기 전용 보관</summary><p>기존 브리핑 데이터는 변경하지 않습니다.</p>{legacyBriefs.map((b, i) => <div key={`${b.date}-${i}`}><span>{Number.isFinite(Date.parse(b.date)) ? new Date(b.date).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : b.date} · {b.scope}</span><button onClick={() => download(`MI-legacy-brief-${i + 1}.md`, b.text)}><ArrowDownToLine size={16} />이전 브리핑 내려받기</button></div>)}</details>}
  </div>;
}
