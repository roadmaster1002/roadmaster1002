import { useState } from 'react';
import { ArrowRight, CalendarDays, Check, Clock3, ExternalLink, Link2, LoaderCircle, RefreshCw, Rss } from 'lucide-react';
import { selectRecentArticles, type FreshnessDays } from '../shared/freshness.mjs';
import { companies, type CompanyId, type Signal } from './data';
import { newsToSignal, type NewsSnapshot } from './newsClient';
import './latest-news.css';

type Props = { snapshot: NewsSnapshot; loading: boolean; error: string; refresh: () => void; scope: CompanyId | 'all'; query: string; category: string; registered: Signal[]; onRegister: (signal: Signal) => void };
function timestamp(value: string | null) { return value ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '성공한 수집 없음'; }

export default function LatestNews({ snapshot, loading, error, refresh, scope, query, category, registered, onRegister }: Props) {
  const [days, setDays] = useState<FreshnessDays>(7);
  const [copied, setCopied] = useState('');
  const live = snapshot.items.map(newsToSignal);
  const all = [...registered, ...live].filter((item, i, array) => array.findIndex(s => s.id === item.id) === i).filter(s => !s.isDemo && (scope === 'all' || s.companyId === scope || s.companyIds?.includes(scope)));
  const fresh = selectRecentArticles(all, { asOfISO: new Date().toISOString(), days });
  const items = fresh.items.filter(s => `${s.title} ${s.summary} ${s.sourceName}`.toLowerCase().includes(query.toLowerCase()) && (category === '전체' || s.category === category));
  const lastSuccess = snapshot.lastSuccessfulAtISO;
  const searchTerms = { ncchem: '(photoresist OR "EUV materials" OR "semiconductor chemicals")', kci: '(polyquaternium OR "hair care ingredients" OR "Samyang KCI")', verdant: '(surfactant OR biosurfactant OR "Verdant Specialty" OR Nouryon)' };
  const searchQuery = `${scope === 'all' ? '(photoresist OR polyquaternium OR surfactant)' : searchTerms[scope]} when:${days}d`;
  const searchUrl = `https://news.google.com/search?${new URLSearchParams({ q: searchQuery, hl: 'en-US', gl: 'US', ceid: 'US:en' })}`;
  async function copy(signal: Signal) { try { await navigator.clipboard.writeText(signal.sourceUrl); setCopied(signal.id); setTimeout(() => setCopied(''), 1800); } catch { setCopied(''); } }
  return <div className="latest-news-panel">
    <div className="latest-controls"><div className="latest-window" role="group" aria-label="뉴스 발행 기간">{([7, 30, 90] as const).map(d => <button key={d} aria-pressed={days === d} className={days === d ? 'active' : ''} onClick={() => setDays(d)}>최근 {d}일</button>)}</div><button className="btn secondary" onClick={refresh} disabled={loading}>{loading ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />}뉴스 갱신 확인</button></div>
    <div className="latest-freshness"><span><CalendarDays size={17} />발행일 기준 최근 {days}일 <strong>{items.length}건</strong></span><span><Clock3 size={16} />마지막 수집 성공 {timestamp(lastSuccess)}</span></div>
    {(error || snapshot.status === 'error' || snapshot.status === 'partial' || snapshot.status === 'not-configured') && <div className="latest-status-note" role="status"><strong>{snapshot.status === 'partial' ? '일부 출처의 수집이 완료되지 않았습니다.' : snapshot.status === 'error' ? '마지막 수집이 실패했습니다. 이전 저장본을 유지합니다.' : snapshot.status === 'not-configured' ? '첫 뉴스 수집을 기다리고 있습니다.' : '갱신 상태를 확인하지 못했습니다.'}</strong><p>{error || snapshot.errors[0] || '등록한 기사는 아래에서 바로 볼 수 있습니다.'}</p><a href="https://github.com/roadmaster1002/roadmaster1002/actions/workflows/refresh-news.yml" target="_blank" rel="noreferrer">자동 수집 실행 상태<ExternalLink size={15} /></a></div>}
    <div className="latest-evidence-note"><Rss size={18} /><p>자동 수집은 뉴스 피드의 제목·발행처·발행일·링크를 제공합니다. <strong>기사 본문은 별도 확인이 필요합니다.</strong> 자동 사업 분류는 키워드 기준입니다. 오래된 문서와 날짜 미확인 자료를 최근 뉴스로 채우지 않습니다.</p></div>
    {items.length ? <div className="latest-grid">{items.map(s => <article className="latest-card" key={s.id}><div className="latest-card-top"><span>{s.date}</span><span>{s.evidenceType === 'feed-metadata' ? 'RSS · 본문 미열람' : '사용자 등록 자료'}</span></div><div className="latest-businesses">{(s.companyIds || [s.companyId]).map(id => <span className={`company-label ${id}`} key={id}><span />{companies.find(c => c.id === id)?.name}</span>)}</div><h3><a href={s.sourceUrl} target="_blank" rel="noreferrer">{s.title}<ExternalLink size={17} /></a></h3><p>{s.summary}</p><div className="latest-source">{s.sourceName} <span>· {s.evidenceType === 'feed-metadata' ? '피드 발행일 기준' : '입력된 원문 발표일 기준'}</span></div><div className="latest-card-actions"><a href={s.sourceUrl} target="_blank" rel="noreferrer">기사 링크 열기<ArrowRight size={16} /></a><button aria-label={`${s.title} 링크 복사`} onClick={() => copy(s)}>{copied === s.id ? <Check size={17} /> : <Link2 size={17} />}</button><button onClick={() => onRegister(s)}>읽은 내용·분석 등록</button></div></article>)}</div> : <div className="latest-empty"><Rss size={35} /><h3>최근 {days}일 조건의 자료가 없습니다.</h3><p>이 결과만으로 시장에 변화가 없었다고 판단할 수 없습니다.<br />수집 상태를 확인하거나 실제 기사 내용을 등록해 주세요.</p><div><a className="btn primary" href={searchUrl} target="_blank" rel="noreferrer">최근 기사 직접 찾기<ExternalLink size={16} /></a><button className="btn secondary" onClick={() => setDays(days === 7 ? 30 : 90)}>최근 {days === 7 ? 30 : 90}일로 넓히기</button><a className="btn secondary" href="https://github.com/roadmaster1002/roadmaster1002/actions/workflows/refresh-news.yml" target="_blank" rel="noreferrer">수집 상태 확인<ExternalLink size={16} /></a></div></div>}
    {(fresh.stats.older > 0 || fresh.stats.unknown > 0 || fresh.stats.future > 0) && <p className="latest-exclusions">기간 이전 {fresh.stats.older}건 · 발행일 미확인 {fresh.stats.unknown}건 · 미래 날짜 {fresh.stats.future}건을 제외했습니다.</p>}
  </div>;
}
