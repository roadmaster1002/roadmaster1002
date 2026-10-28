/** Shared deterministic evidence analysis; no network or platform-specific dependencies. */
const MAX_SIGNALS = 40;
const COMPANY_IDS = new Set(['ncchem', 'kci', 'verdant']);
const MODES = [
  { match: /규제|정책|인증|환경|규정|regulat/i, name: '규제·정책', terms: /규제|정책|인증|환경|규정|지속가능/ },
  { match: /기술|특허|반도체|연구|R&D|소재/i, name: '기술·특허', terms: /기술|특허|반도체|연구|소재|공정/ },
  { match: /투자|증설|생산|공급|CAPEX/i, name: '투자·공급', terms: /투자|증설|생산|공급|설비/ },
  { match: /제품|시장|고객|가격|수요|매출/i, name: '제품·시장', terms: /제품|시장|고객|가격|수요/ },
];

export class InputError extends Error {}

function requiredString(value, field, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new InputError(`${field}는 1~${max}자의 문자열이어야 합니다.`);
  }
  return value.trim();
}

function optionalString(value, field, max) {
  return value == null || value === '' ? '' : requiredString(value, field, max);
}

function isoDate(value, field, required = false) {
  if (!required && (value == null || value === '')) return '';
  const date = requiredString(value, field, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new InputError(`${field}는 유효한 YYYY-MM-DD 날짜여야 합니다.`);
  }
  return date;
}

export function validateInput(body, brief = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InputError('요청 형식을 확인해 주세요.');
  const question = brief ? '선택한 자료를 바탕으로 주간 MI 브리핑을 작성하고 핵심 동향, 기획 시사점, 다음 확인 과제를 정리해 주세요.' : requiredString(body.question, '질문', 2000);
  const company = optionalString(body.company, '기업', 120);
  let period;
  if (body.period != null) {
    if (typeof body.period !== 'object' || Array.isArray(body.period)) throw new InputError('분석 기간 형식을 확인해 주세요.');
    period = { start: isoDate(body.period.start, '기간 시작일', true), end: isoDate(body.period.end, '기간 종료일', true) };
    if (period.start > period.end) throw new InputError('분석 기간의 시작일이 종료일보다 늦습니다.');
  }
  if (!Array.isArray(body.signals) || body.signals.length > MAX_SIGNALS) {
    throw new InputError(`자료는 배열로 최대 ${MAX_SIGNALS}개까지 전달할 수 있습니다.`);
  }
  const seen = new Set();
  const signals = body.signals.map((signal) => {
    if (!signal || typeof signal !== 'object' || Array.isArray(signal)) throw new InputError('자료 형식을 확인해 주세요.');
    const id = requiredString(signal.id, '자료 ID', 100);
    if (seen.has(id)) throw new InputError('자료 ID는 중복될 수 없습니다.');
    seen.add(id);
    const sourceUrl = optionalString(signal.sourceUrl, '출처 URL', 2000);
    if (sourceUrl) {
      let url;
      try { url = new URL(sourceUrl); } catch { throw new InputError('출처 URL이 유효하지 않습니다.'); }
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new InputError('출처에는 인증정보 없는 HTTP(S) URL만 사용할 수 있습니다.');
    }
    if (typeof signal.isDemo !== 'boolean') throw new InputError('각 자료의 예시 여부(isDemo)를 지정해 주세요.');
    return {
      id,
      title: requiredString(signal.title, '제목', 500),
      summary: optionalString(signal.summary, '요약', 4000),
      implication: optionalString(signal.implication, '시사점', 2000),
      sourceName: optionalString(signal.sourceName, '출처명', 200),
      sourceUrl,
      date: isoDate(signal.date, '자료 날짜'),
      companyId: optionalString(signal.companyId, '기업 ID', 120),
      companyIds: Array.isArray(signal.companyIds) ? [...new Set(signal.companyIds.filter(id => COMPANY_IDS.has(id)))] : [],
      evidenceType: signal.evidenceType === 'feed-metadata' ? 'feed-metadata' : 'registered',
      isDemo: signal.isDemo,
    };
  });
  return { question, company, signals, brief, period };
}

export function selectSignals({ question, company, signals, brief = false, period }) {
  const companyFiltered = COMPANY_IDS.has(company) ? signals.filter((signal) => signal.companyId === company || signal.companyIds?.includes(company)) : signals;
  const filtered = period ? companyFiltered.filter((signal) => signal.date && signal.date >= period.start && signal.date <= period.end) : companyFiltered;
  if (brief) return filtered;
  const mode = MODES.find((item) => item.match.test(question));
  const terms = question.toLowerCase().match(/[a-z0-9]{2,}|[가-힣]{2,}/g) || [];
  return filtered.map((signal, index) => {
    const haystack = `${signal.title} ${signal.summary} ${signal.implication}`.toLowerCase();
    const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 2 : 0), 0) + (mode?.terms.test(haystack) ? 3 : 0);
    return { signal, score, index };
  }).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 6).map((item) => item.signal);
}

export function provenanceNotice(signals) {
  const demo = signals.filter((signal) => signal.isDemo).length;
  const feeds = signals.filter((signal) => signal.evidenceType === 'feed-metadata').length;
  if (feeds > 0) return `뉴스 피드 메타데이터 ${feeds}건${demo ? `과 예시 ${demo}건` : ''}이 포함된 자료 기반 정리입니다. 뉴스의 제목·발행처·피드 발행일만 수집했으며 기사 본문과 사실 여부는 검증하지 않았습니다. 키워드로 연결한 사업 분류는 실제 경쟁 관계나 사업 영향을 확인한 결과가 아닙니다.${demo ? ' 예시는 실제 뉴스가 아닙니다.' : ''}`;
  if (demo === signals.length && demo > 0) return '예시 자료 기반 분석입니다. 아래 신호는 실제 최신 뉴스가 아닌 데모 시나리오이며, 출처 링크는 사실 검증을 위한 참고 사이트입니다.';
  if (demo > 0) return `등록 자료와 예시 자료가 함께 포함되어 있습니다. ${demo}개 예시 신호는 실제 뉴스가 아니므로 의사결정 전에 구분해 검증하세요.`;
  return '사용자가 등록한 자료에 근거한 분석입니다. 원문과 사실 여부를 별도로 검증하지 않았으며 실시간 시장 조사 결과는 아닙니다.';
}

export function sourcesText(signals) {
  return ['참고 자료', ...signals.map((signal) => `[${signal.id}] ${signal.sourceName || '등록 출처'} · ${signal.date || '날짜 미등록'} · ${signal.isDemo ? '예시 시나리오: 실제 뉴스 아님' : signal.evidenceType === 'feed-metadata' ? '뉴스 피드 메타데이터: 기사 본문 미열람' : '사용자 등록: 원문 미검증'}\n${signal.sourceUrl || 'URL 미등록'}`)].join('\n');
}

export function periodText(input) {
  return input.period ? `분석 기간: ${input.period.start} ~ ${input.period.end} (자료에 등록된 날짜 기준, 날짜 미등록 자료 제외)` : '';
}

function localLimitNotice(input, selected) {
  if (input.brief) return '';
  const evidence = selected.filter((signal) => !signal.isDemo).map((signal) => `${signal.title} ${signal.summary}`).join(' ');
  const financialTerms = input.question.match(/매출|영업이익|실적|수익|마진|점유율|시장\s*규모|CAGR|EPS/gi) || [];
  if (/예측|전망|내년|내후년|미래|forecast/i.test(input.question)) return '근거 한계: 로컬 모드는 미래 실적·가격·시장 전망을 예측하지 않습니다. 아래는 제공된 자료의 정리이며 전망이나 수치 추정이 아닙니다.';
  if (financialTerms.some((term) => !evidence.toLowerCase().includes(term.toLowerCase()))) return '근거 부족: 요청한 재무·시장 수치를 확인할 검증된 자료가 없습니다. 실제 수치나 실적을 추정하지 않으며, 공시·원문 보고서를 등록한 뒤 확인해야 합니다. 아래는 현재 자료에 한정한 참고 맥락입니다.';
  const terms = input.question.toLowerCase().match(/[a-z0-9]{3,}|[가-힣]{2,}/g) || [];
  const related = selected.some((signal) => terms.some((term) => `${signal.title} ${signal.summary}`.toLowerCase().includes(term)));
  if (!related && !/동향|시사점|모니터링|브리핑|경쟁|시장|핵심|검토|과제/.test(input.question) && !MODES.some((mode) => mode.match.test(input.question))) return '근거 부족: 제공된 자료만으로 이 질문에 직접 답할 근거를 찾지 못했습니다. 아래는 질문에 대한 확정 답변이 아닌 현재 등록 자료의 참고 정리입니다.';
  return '';
}

export function createLocalAnalysis(input) {
  const selected = selectSignals(input);
  if (!selected.length) {
    return {
      answer: [periodText(input), '분석할 자료가 없습니다. 선택한 기업·기간의 자료를 등록하거나 필터를 변경한 뒤 다시 요청해 주세요. 최신 경쟁 동향을 판단하려면 날짜와 원문 출처를 함께 등록하는 것이 좋습니다.'].filter(Boolean).join('\n\n'),
      mode: 'local',
      citations: [],
    };
  }
  const focus = MODES.find((item) => item.match.test(input.question));
  const lines = [
    input.brief ? '주간 MI 브리핑 · 자료 기반 초안' : `${focus ? `${focus.name} 중심 ` : ''}MI 분석`,
    '',
    provenanceNotice(selected),
    ...(localLimitNotice(input, selected) ? ['', localLimitNotice(input, selected)] : []),
    '',
    '검토 범위',
    `질문: ${input.question}`,
    ...(input.period ? [periodText(input)] : []),
    `전달 자료 ${input.signals.length}건 중 기업·기간·질문에 따라 선택한 ${selected.length}건을 검토했습니다. 로컬 모드에서는 등록 문장과 규칙으로 초안을 구성하며, 외부 조사나 LLM 추론을 수행하지 않습니다.`,
    '',
    '핵심 동향과 기획 시사점',
  ];
  selected.forEach((signal, i) => {
    lines.push(`${i + 1}. ${signal.title}${signal.isDemo ? ' [예시]' : ' [등록 자료]'}`);
    if (signal.summary) lines.push(`   관찰: ${signal.summary}`);
    lines.push(`   검토할 시사점: ${signal.implication || '원문의 사업 영향과 해당 기업의 제품·고객군 중첩을 확인하세요.'}`);
    lines.push(`   근거: [${signal.id}] ${signal.sourceName || '등록 출처'} · ${signal.date || '날짜 미등록'}`);
  });
  lines.push('', '다음 확인 과제');
  if (focus?.name === '규제·정책') {
    lines.push('• 규제의 적용 지역·발효일·대상 물질을 원문으로 확인하세요.', '• 해당 제품의 인증·원료 대체·고객 승인 필요 여부를 사업 담당자와 확인하세요.');
  } else if (focus?.name === '기술·특허') {
    lines.push('• 특허 청구항·기술 성숙도와 당사 제품의 적용 공정을 확인하세요.', '• 고객 평가·양산 승인 여부를 검증한 뒤 기술 대체 가능성을 검토하세요.');
  } else if (focus?.name === '투자·공급') {
    lines.push('• 발표된 투자액·공장 위치·가동 시점을 원문으로 확인하세요.', '• 생산능력과 실제 출하량을 구분하고 고객군·원료 조달 중첩을 점검하세요.');
  } else {
    lines.push('• 경쟁사의 공식 발표·공시·제품 자료로 신호의 날짜와 사실 여부를 검증하세요.', '• 당사와 겹치는 제품·고객·지역을 좁혀 영향도와 대응 담당자를 지정하세요.');
  }
  lines.push('• 검증된 사실, 가설, 미확인 사항을 구분한 뒤 주간 회의 안건으로 전환하세요.');
  lines.push('', sourcesText(selected));
  return { answer: lines.join('\n'), mode: 'local', citations: selected.map((signal) => signal.id) };
}
