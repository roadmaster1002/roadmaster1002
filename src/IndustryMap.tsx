import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, ArrowUpRight, Check, ChevronDown, CircleHelp, ExternalLink, Factory, FlaskConical, Layers3, Search, ShieldCheck, Target, X } from 'lucide-react';
import { companies, type CompanyId } from './data';
import { chains, type ChainParticipant, type ProcessStage } from './valueChainData';
import './industry-map.css';

type Props = { scope: CompanyId | 'all'; onScopeChange: (id: CompanyId) => void; onFeed: () => void };
const chainLabels: Record<CompanyId, string> = { ncchem: '반도체 · 전자재료', kci: '퍼스널케어 원료', verdant: '계면활성제 · 스페셜티' };
const stageColors = ['#6b7d90', '#408e85', '#6b80ba', '#be8d60', '#9a7bb1', '#5b99a2', '#739b6c', '#ae7d97'];

export default function IndustryMap({ scope, onScopeChange, onFeed }: Props) {
  const activeId = scope === 'all' ? 'ncchem' : scope;
  const chain = chains[activeId];
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState('all');
  const [stageId, setStageId] = useState(chain.stages[0].id);
  const [selected, setSelected] = useState<{ participant: ChainParticipant; stage: ProcessStage; companyId: CompanyId } | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const stage = chain.stages.find(s => s.id === stageId) || chain.stages[0];
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const selectedTheme = theme === 'all' ? undefined : chain.themes.find(t => t.id === theme);
  const matches = query.trim() ? Object.entries(chains).flatMap(([id, c]) => c.stages.flatMap(s => [...s.equipment, ...s.materials].filter(p => `${p.name} ${p.role} ${p.description}`.toLowerCase().includes(query.trim().toLowerCase())).map(p => ({ participant: p, stage: s, companyId: id as CompanyId })))).filter((item, i, array) => array.findIndex(p => p.companyId === item.companyId && p.participant.id === item.participant.id) === i) : [];
  const participantCount = new Set(chain.stages.flatMap(s => [...s.equipment, ...s.materials].map(p => p.name))).size;
  useEffect(() => { setTheme('all'); setStageId(chains[activeId].stages[0].id); setExpanded([]); }, [activeId]);
  useEffect(() => { if (selected) dialog.current?.showModal(); }, [selected]);
  function close() { dialog.current?.close(); setSelected(null); }
  function showParticipants(items: ChainParticipant[], s: ProcessStage, kind: 'equipment' | 'materials') {
    const expandedId = `${s.id}-${kind}`;
    const visible = expanded.includes(expandedId) ? items : items.slice(0, 2);
    return <>{visible.map(p => <button key={p.id} className={`chain-company ${p.relationship === '자사' ? 'own' : ''}`} onClick={() => setSelected({ participant: p, stage: s, companyId: activeId })}><span className="chain-company-name">{p.name}{p.relationship === '자사' ? <small>OUR BUSINESS</small> : <ArrowUpRight size={11} />}</span><span className="chain-company-role">{p.role}</span></button>)}{items.length > 2 && <button className="chain-more" onClick={() => setExpanded(old => old.includes(expandedId) ? old.filter(x => x !== expandedId) : [...old, expandedId])}>{expanded.includes(expandedId) ? '접기' : `+${items.length - 2}개 기업 더 보기`}<ChevronDown size={11} /></button>}{!items.length && <span className="chain-continues">다음 공정으로 <ArrowRight size={12} /></span>}</>;
  }
  return <div className="industry-map">
    <div className="chain-selector" role="group" aria-label="산업 선택">{companies.map(c => <button key={c.id} aria-pressed={activeId === c.id} className={activeId === c.id ? 'active' : ''} onClick={() => { onScopeChange(c.id); setQuery(''); }}><span className={`small-dot ${c.id}`} /><div><strong>{chainLabels[c.id]}</strong><small>{c.name}</small></div>{activeId === c.id && <Check size={15} />}</button>)}</div>
    <div className="chain-search-row"><label className="search-field"><Search size={17} /><input aria-label="산업 전체 기업 검색" value={query} onChange={e => setQuery(e.target.value)} placeholder="기업 이름이나 제품으로 찾기 (전체 산업)" />{query && <button aria-label="기업 검색 지우기" onClick={() => setQuery('')}><X size={14} /></button>}</label><span><Layers3 size={14} />3개 산업의 밸류체인을 연결합니다.</span></div>
    {query.trim() && <section className="chain-search-results panel" aria-live="polite"><div className="section-heading"><h2>전체 산업 검색 결과 <span className="count-badge">{matches.length}</span></h2><button className="text-link" onClick={() => setQuery('')}>검색 닫기<X size={13} /></button></div>{matches.length ? <div>{matches.map((m, i) => <button key={`${m.companyId}-${m.participant.id}-${i}`} onClick={() => { onScopeChange(m.companyId); setSelected(m); }}><span className={`small-dot ${m.companyId}`} /><div><strong>{m.participant.name}</strong><small>{chainLabels[m.companyId]} · {m.stage.name} · {m.participant.role}</small></div><ArrowUpRight size={15} /></button>)}</div> : <p>해당 기업이나 제품이 아직 등록되지 않았습니다. 다른 검색어를 입력해 주세요.</p>}</section>}
    <section className="chain-canvas panel">
      <div className="chain-intro"><div className="mini-eyebrow">INDUSTRY VALUE CHAIN <span>/{activeId === 'ncchem' ? '01' : activeId === 'kci' ? '02' : '03'}</span></div><h2>{chain.title}</h2><h3>산업의 흐름 × 기업의 역할 × 수익 구조</h3><p>{chain.subtitle}</p><div className="chain-endpoints"><span><i /><strong>출발</strong> {chain.startingPoint}</span><span className="endpoint-line"><span /><ArrowRight size={17} /></span><span><strong>도착</strong> {chain.endingPoint}<Factory size={22} /></span></div></div>
      <div className="chain-guide"><span><i className="legend-equipment" />위: 장비·기술 / 서비스</span><span><i className="legend-material" />아래: 원료·소재 / 제품</span><span><i className="legend-own" />삼양 사업 위치</span><span><ArrowUpRight size={12} />기업을 누르면 사업 구조</span></div>
      <div className="chain-theme-heading"><h3>공정과 테마로 살펴보기</h3><span>{chain.stages.length}개 단계 · {participantCount}개 기업 참고 분류</span></div>
      <div className="chain-theme-tabs" role="group" aria-label="공정 테마"><button aria-pressed={theme === 'all'} className={theme === 'all' ? 'active' : ''} onClick={() => setTheme('all')}>전체 공정</button>{chain.themes.filter(t => t.id !== 'all').map(t => <button key={t.id} aria-pressed={theme === t.id} className={theme === t.id ? 'active' : ''} onClick={() => { setTheme(t.id); const first = chain.stages.find(s => t.stageIds.includes(s.id)); if (first) setStageId(first.id); }}>{t.label}</button>)}</div>
      <div className="chain-scroll-caption"><span>공정 이름을 누르면 투입·변환·결과와 MI 체크포인트를 볼 수 있습니다.</span><span>좌우로 이동 <ArrowRight size={13} /></span></div>
      <div className="chain-horizontal-scroll" tabIndex={0} aria-label={`${chainLabels[activeId]} 산업 공정 지도, 좌우 스크롤 가능`}>
        <div className="chain-grid" style={{ '--stage-count': chain.stages.length } as CSSProperties}>
          {chain.stages.map((s, i) => <div key={`equip-${s.id}`} className={`chain-equipment ${selectedTheme && !selectedTheme.stageIds.includes(s.id) ? 'dimmed' : ''}`}><div className="chain-row-label">{i === 0 && <><Factory size={11} />장비 · 기술 · 서비스</>}</div>{showParticipants(s.equipment, s, 'equipment')}</div>)}
          {chain.stages.map((s, i) => <button key={`stage-${s.id}`} aria-pressed={s.id === stage.id} className={`chain-stage ${s.id === stage.id ? 'selected' : ''} ${selectedTheme && !selectedTheme.stageIds.includes(s.id) ? 'dimmed' : ''}`} style={{ '--stage-color': stageColors[i % stageColors.length] } as CSSProperties} onClick={() => setStageId(s.id)}><span className="chain-stage-number">{String(i + 1).padStart(2, '0')} <span>PROCESS</span></span><strong>{s.name}</strong><small>{s.subtitle}</small><span className="chain-stage-bottom"><span className="stage-wafer"><i /><i /><i /></span><ArrowRight size={15} /></span></button>)}
          {chain.stages.map((s, i) => <div key={`mat-${s.id}`} className={`chain-materials ${selectedTheme && !selectedTheme.stageIds.includes(s.id) ? 'dimmed' : ''}`}><div className="chain-row-label">{i === 0 && <><FlaskConical size={11} />원료 · 소재 · 제품</>}</div>{showParticipants(s.materials, s, 'materials')}</div>)}
        </div>
      </div>
      <div className="chain-repeat-note"><Layers3 size={14} /><span>{activeId === 'ncchem' ? '포토·식각·증착은 반복되고, 세정·분석은 여러 공정에 걸칩니다. 공정은 이해를 위한 대표 흐름입니다.' : '응용 제품과 제조 방식에 따라 공정이 반복·병행됩니다. 기업 표시는 역할 참고이며 공급 계약을 의미하지 않습니다.'}</span></div>
      <section className="stage-explainer" aria-live="polite"><div className="stage-explainer-heading"><div><span className="mini-eyebrow">FOLLOW THE VALUE</span><h3>{String(chain.stages.indexOf(stage) + 1).padStart(2, '0')}. {stage.name}</h3></div><span className="outline-badge">공정의 역할</span></div><p>{stage.role}</p><div className="input-output"><div><span>INPUT · 투입</span><strong>{stage.input}</strong></div><ArrowRight size={19} /><div><span>PROCESS · 변환</span><strong>{stage.transformation}</strong></div><ArrowRight size={19} /><div><span>OUTPUT · 결과</span><strong>{stage.output}</strong></div></div><div className="stage-watchpoints"><h4><Target size={15} />기획팀 MI 체크포인트</h4><ul>{stage.watchPoints.map(w => <li key={w}>{w}</li>)}</ul></div></section>
      <div className="chain-data-note"><ShieldCheck size={15} /><p>공개 사업 영역을 바탕으로 구성한 <strong>초기 조사 지도</strong>입니다. 제품별 직접 경쟁, 공급 관계, 시장점유율을 확정하지 않습니다. 기업 공식 자료와 자사 제품 범위를 확인해 보완해 주세요.</p><button onClick={onFeed}>시장 신호 연결<ArrowRight size={14} /></button></div>
    </section>
    <section className="chain-bottom-cards"><div><CircleHelp size={20} /><h3>기업은 어디서 가치를 만들까요?</h3><p>공정에 필요한 원료·장비·기술을 제공하고, 인증·성능·수율·서비스로 차별화합니다. 기업 카드를 눌러 일반적인 수익 구조와 확인할 자료를 살펴보세요.</p></div><div><Target size={20} /><h3>산업 지도에서 MI 과제로</h3><p>기술 변화 → 경쟁사 대응 → 고객 영향 → 자사 기회 순으로 관찰하세요. 확인한 원문 자료는 ‘자료 등록’으로 모아 주간 브리핑에 연결할 수 있습니다.</p></div></section>
    {selected && <dialog ref={dialog} aria-labelledby={titleId} className="modal wide chain-company-dialog" onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }}><div className="modal-header"><h2 id={titleId}>기업의 역할과 사업 구조</h2><button className="icon-btn" aria-label="기업 상세 닫기" onClick={close}><X size={20} /></button></div><div className="chain-company-detail"><div className="chain-detail-eyebrow"><span className={`company-label ${selected.companyId}`}><span />{chainLabels[selected.companyId]}</span><span className={`relationship ${selected.participant.relationship === '자사' ? 'own' : ''}`}>{selected.participant.relationship}</span></div><h2>{selected.participant.name}</h2><p className="chain-detail-role">{selected.participant.role}</p><div className="chain-detail-stage"><Layers3 size={15} />{selected.stage.name}<ArrowRight size={14} />{selected.stage.output}</div><h3>어떤 역할을 하나요?</h3><p>{selected.participant.description}</p><section className="earnings-logic"><h3>돈을 버는 흐름 <span>일반적인 사업 모델</span></h3><p>{selected.participant.earningsLogic}</p></section><h3>MI를 위해 확인할 자료</h3><ul>{selected.participant.watchPoints.map(w => <li key={w}>{w}</li>)}</ul><div className="detail-note">산업 내 역할에 관한 참고 분류입니다. 실제 매출 구성·고객·납품 관계는 공시와 최신 제품 자료로 확인해야 합니다.</div><div className="modal-actions"><a className="btn secondary" href={selected.participant.sourceUrl} target="_blank" rel="noreferrer">공식 자료 확인<ExternalLink size={14} /></a><button className="btn primary" onClick={() => { onScopeChange(selected.companyId); close(); onFeed(); }}>관련 시장 신호<ArrowRight size={15} /></button></div></div></dialog>}
  </div>;
}
