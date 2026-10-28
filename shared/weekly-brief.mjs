/**
 * Deterministic, browser-safe weekly evidence briefing.
 * Counts describe supplied records, never the complete market or verified facts.
 */
const BUSINESSES = [
  { companyId: 'ncchem', label: '삼양엔씨켐' },
  { companyId: 'kci', label: '삼양KCI' },
  { companyId: 'verdant', label: 'Verdant' },
];
const BUSINESS_IDS = new Set(BUSINESSES.map(item => item.companyId));
const IMPACT_ORDER = { '높음': 0, '보통': 1, '낮음': 2 };
const MAX_RECORDS_PER_PERIOD = 40;
const DAY = 86_400_000;

export class WeeklyBriefError extends Error {}

function text(value) { return typeof value === 'string' ? value.trim() : ''; }

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

function seoulDate(value) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const part = name => parts.find(item => item.type === name)?.value || '';
  return `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`;
}

function dateOffset(value, amount) {
  return new Date(Date.parse(`${value}T00:00:00Z`) + amount * DAY).toISOString().slice(0, 10);
}

function safeUrl(value) {
  if (!text(value)) return '';
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

function normalizedUrl(value) {
  const safe = safeUrl(value);
  if (!safe) return '';
  const url = new URL(safe);
  url.hash = '';
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || /^(?:fbclid|gclid|msclkid)$/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  return url.href;
}

function normalizedTitle(value) { return text(value).normalize('NFKC').replace(/\s+/g, ' ').toLowerCase(); }

function evidenceKey(signal) {
  // Different headlines on a shared company homepage remain distinct records.
  return `${normalizedUrl(signal.sourceUrl) || `source:${normalizedTitle(signal.sourceName)}`}\u0000${normalizedTitle(signal.title)}`;
}

function sourceKey(signal) {
  // RSS links may point to a Google News redirect, not the actual publisher.
  // The feed's explicit publisher label is the source identity in this case.
  if (signal.evidenceType === 'feed-metadata' && normalizedTitle(signal.sourceName)) return normalizedTitle(signal.sourceName);
  const url = safeUrl(signal.sourceUrl);
  if (url) return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  return normalizedTitle(signal.sourceName);
}

function sourceCount(signals) { return new Set(signals.map(sourceKey).filter(Boolean)).size; }

function normalizeSignals(signals, field) {
  if (!Array.isArray(signals)) throw new WeeklyBriefError(`${field}는 자료 배열이어야 합니다.`);
  return signals.map((signal, index) => {
    if (!signal || typeof signal !== 'object' || Array.isArray(signal) || !text(signal.id) || !text(signal.title)) {
      throw new WeeklyBriefError(`${field}의 ${index + 1}번째 자료에 ID와 제목이 필요합니다.`);
    }
    if (typeof signal.isDemo !== 'boolean') throw new WeeklyBriefError('자료의 예시 여부(isDemo)를 명시해 주세요.');
    return {
      id: text(signal.id), title: text(signal.title), companyId: text(signal.companyId),
      companyIds: [...new Set([text(signal.companyId), ...(Array.isArray(signal.companyIds) ? signal.companyIds.filter(value => typeof value === 'string') : [])].filter(value => BUSINESS_IDS.has(value)))],
      evidenceType: signal.evidenceType === 'feed-metadata' ? 'feed-metadata' : 'registered',
      date: validDate(signal.date) ? signal.date : '',
      summary: text(signal.summary), implication: text(signal.implication),
      sourceName: text(signal.sourceName), sourceUrl: safeUrl(signal.sourceUrl),
      impact: Object.hasOwn(IMPACT_ORDER, signal.impact) ? signal.impact : '보통',
      category: text(signal.category) || '미분류', isDemo: signal.isDemo,
      followUp: text(signal.articleDetails?.notes?.followUp),
    };
  });
}

function belongsTo(signal, companyId) { return signal.companyId === companyId || signal.companyIds.includes(companyId); }

function inPeriod(signal, period) { return signal.date && signal.date >= period.start && signal.date <= period.end; }

function compareSignals(a, b) {
  return IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact]
    || b.date.localeCompare(a.date)
    || a.id.localeCompare(b.id);
}

function dedupe(signals) {
  const keys = new Map();
  const result = [];
  for (const signal of [...signals].sort(compareSignals)) {
    const key = evidenceKey(signal);
    const existing = keys.get(key);
    if (!existing) {
      const record = { ...signal, companyIds: [...signal.companyIds] };
      keys.set(key, record); result.push(record);
    } else {
      // One source can inform several businesses without becoming several news items.
      existing.companyIds = [...new Set([...existing.companyIds, ...signal.companyIds])];
      existing.followUp = [...new Set([existing.followUp, signal.followUp].filter(Boolean))].join('\n');
    }
  }
  return { records: result, duplicates: signals.length - result.length };
}

function mdCell(value) { return String(value).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' '); }
function mdLine(value) { return String(value).replace(/[\r\n]+/g, ' '); }

export function weeklyBriefToMarkdown(brief) {
  const { coverage } = brief;
  const lines = [
    '# 화학2그룹 주간 MI 브리핑',
    '',
    '> 입력 자료에 근거한 구조화 초안입니다. 원문 사실 검증이나 전체 시장 조사를 수행한 결과가 아닙니다.',
    '',
    `- 분석 기간: ${brief.period.start} ~ ${brief.period.end} (자료에 등록된 발표일 기준)`,
    `- 비교 기간: ${brief.previousPeriod.start} ~ ${brief.previousPeriod.end}`,
    `- 분석 범위: ${brief.scope === 'all' ? '화학2그룹 전체' : BUSINESSES.find(item => item.companyId === brief.scope)?.label}`,
    ...(brief.generatedAt ? [`- 생성 시각: ${brief.generatedAt}`] : []),
    '',
    '## 1. 핵심 요약',
    '',
    ...brief.executiveSummary.map(item => `- ${mdLine(item)}`),
    '',
    '## 2. 근거 범위와 누락',
    '',
    '| 항목 | 이번 기간 | 비교 기간 |',
    '| --- | ---: | ---: |',
    `| 검토한 자료 | ${coverage.currentCount}건 | ${coverage.previousCount}건 |`,
    `| 서로 다른 발행처/출처 호스트 | ${coverage.sourceCount}곳 | ${coverage.previousSourceCount}곳 |`,
    '',
    `제외 내역: 기능 예시 ${coverage.excludedDemoCount}건 · 이번 기간 밖 ${coverage.excludedOutsidePeriodCount}건 · 날짜 미등록/잘못된 날짜 ${coverage.undatedCount}건 · 중복 ${coverage.duplicateCount}건.`,
    ...(coverage.truncatedCount || coverage.previousTruncatedCount ? [`처리 한도 제외: 이번 기간 ${coverage.truncatedCount}건 · 비교 기간 ${coverage.previousTruncatedCount}건.`] : []),
    '',
    '## 3. 우선 검토할 변화',
    '',
  ];
  if (!brief.topChanges.length) lines.push('선택 기간의 근거 자료가 없어 핵심 변화를 작성하지 않았습니다. 자료가 없다는 이유로 시장 변화가 없었다고 판단할 수 없습니다.');
  brief.topChanges.forEach((change, index) => {
    lines.push(
      `### ${index + 1}. ${mdLine(change.title)}`,
      `- 사업: ${BUSINESSES.find(item => item.companyId === change.companyId)?.label || '미분류'} · 발표일: ${change.date} · 등록 우선도: ${change.impact}`,
      `- 전주 기록 대조: ${change.comparison}`,
      `- ${change.evidenceType === 'feed-metadata' ? 'RSS 메타데이터(기사 본문 미열람)' : '등록된 관찰'}: ${mdLine(change.summary || '요약 미등록 — 원문 확인 필요')}`,
      `- 담당자 해석/검토 사항: ${mdLine(change.implication || '사업 영향 노트가 없습니다. 적용 제품·고객·지역을 먼저 확인하세요.')}`,
      `- 근거: [${mdLine(change.id)}] ${mdLine(change.sourceName || '출처명 미등록')}${change.sourceUrl ? ` — <${change.sourceUrl}>` : ' — URL 미등록'}`,
      '',
    );
  });
  lines.push('## 4. 사업별 관찰과 검토 사항', '', '| 사업 | 기간 내 자료 | 발행처/출처 | 상태 |', '| --- | ---: | ---: | --- |');
  for (const business of brief.businesses) lines.push(`| ${business.label} | ${business.signalCount}건 | ${business.sourceCount}곳 | ${business.status} |`);
  for (const business of brief.businesses) {
    lines.push('', `### ${business.label}`, ...business.observations.map(item => `- 관찰: ${mdLine(item)}`), ...business.implications.map(item => `- 검토: ${mdLine(item)}`));
  }
  lines.push('', '## 5. 후속 액션', '', '| 사업 | 할 일 | 근거 | 담당 | 기한 | 상태 |', '| --- | --- | --- | --- | --- | --- |');
  if (!brief.actionItems.length) lines.push('| 전체 | 선택 기간의 원문 자료를 확보한 뒤 액션을 정합니다. | 없음 | 미지정 | 미정 | 미착수 |');
  for (const action of brief.actionItems) {
    lines.push(`| ${BUSINESSES.find(item => item.companyId === action.companyId)?.label || '미분류'} | ${mdCell(action.task)} | ${action.evidenceIds.map(id => `[${mdCell(id)}]`).join(', ')} | ${mdCell(action.owner || '미지정')} | ${mdCell(action.dueDate || '미정')} | ${mdCell(action.status)} |`);
  }
  lines.push('', '## 6. 원문 출처', '');
  if (!brief.sources.length) lines.push('이번 기간에 인용할 자료가 없습니다.');
  for (const source of brief.sources) {
    lines.push(`- [${mdLine(source.id)}] ${mdLine(source.title)} — ${mdLine(source.sourceName || '출처명 미등록')} · ${source.date} · ${source.isDemo ? '기능 예시: 실제 기사 아님' : source.evidenceType === 'feed-metadata' ? 'RSS 메타데이터: 기사 본문 미열람·사실 미검증' : '등록 자료: 독립 사실 검증 안 됨'}`, source.sourceUrl ? `  <${source.sourceUrl}>` : '  URL 미등록');
  }
  if (text(brief.meetingNotes)) lines.push('', '## 회의 메모', '', text(brief.meetingNotes));
  lines.push('', '## 7. 해석의 한계', '', ...brief.limitations.map(item => `- ${mdLine(item)}`));
  return `${lines.join('\n')}\n`;
}

/**
 * previousSignals, when omitted, is inferred from dates in signals.
 * Exclusion counters describe signals after scope filtering; duplicateCount
 * covers both time windows. At most40 unique records are retained per window.
 */
export function buildWeeklyBrief({ signals, company, period, includeExamples = false, previousSignals, asOfISO } = {}) {
  if (!period || !validDate(period.start) || !validDate(period.end) || period.start > period.end) throw new WeeklyBriefError('유효한 분석 시작일과 종료일(YYYY-MM-DD)을 지정해 주세요.');
  if (typeof includeExamples !== 'boolean') throw new WeeklyBriefError('예시 포함 여부는 true 또는 false여야 합니다.');
  if (asOfISO != null && (typeof asOfISO !== 'string' || !Number.isFinite(Date.parse(asOfISO)))) throw new WeeklyBriefError('생성 시각은 유효한 ISO 날짜·시간이어야 합니다.');
  if (asOfISO != null && period.end > seoulDate(asOfISO)) throw new WeeklyBriefError(`미래 날짜를 종료일로 하는 브리핑은 만들 수 없습니다. 서울 기준 ${seoulDate(asOfISO)}까지 선택해 주세요.`);
  const scope = BUSINESS_IDS.has(company) ? company : 'all';
  const days = (Date.parse(`${period.end}T00:00:00Z`) - Date.parse(`${period.start}T00:00:00Z`)) / DAY + 1;
  const previousPeriod = { start: dateOffset(period.start, -days), end: dateOffset(period.start, -1) };
  const currentInput = normalizeSignals(signals, 'signals').filter(signal => scope === 'all' || belongsTo(signal, scope));
  const priorInput = previousSignals == null ? currentInput : normalizeSignals(previousSignals, 'previousSignals').filter(signal => scope === 'all' || belongsTo(signal, scope));
  const eligible = currentInput.filter(signal => includeExamples || !signal.isDemo);
  const currentDedupe = dedupe(eligible.filter(signal => inPeriod(signal, period)));
  const previousDedupe = dedupe(priorInput.filter(signal => (includeExamples || !signal.isDemo) && inPeriod(signal, previousPeriod)));
  const current = currentDedupe.records.slice(0, MAX_RECORDS_PER_PERIOD);
  const previous = previousDedupe.records.slice(0, MAX_RECORDS_PER_PERIOD);
  const coverage = {
    currentCount: current.length,
    previousCount: previous.length,
    sourceCount: sourceCount(current),
    feedMetadataCount: current.filter(signal => signal.evidenceType === 'feed-metadata').length,
    previousSourceCount: sourceCount(previous),
    excludedDemoCount: includeExamples ? 0 : currentInput.filter(signal => signal.isDemo).length,
    excludedOutsidePeriodCount: eligible.filter(signal => signal.date && !inPeriod(signal, period)).length,
    undatedCount: eligible.filter(signal => !signal.date).length,
    duplicateCount: currentDedupe.duplicates + previousDedupe.duplicates,
    truncatedCount: currentDedupe.records.length - current.length,
    previousTruncatedCount: previousDedupe.records.length - previous.length,
  };
  const previousByKey = new Map(previous.map(signal => [evidenceKey(signal), signal]));
  const previousCompanies = new Set(previous.flatMap(signal => signal.companyIds));
  const topChanges = current.slice(0, 5).map(({ followUp: _followUp, ...signal }) => {
    const matchingPrior = previousByKey.get(evidenceKey(signal));
    const sameBusinessMatch = matchingPrior && signal.companyIds.some(id => matchingPrior.companyIds.includes(id));
    return { ...signal, comparison: !signal.companyIds.some(id => previousCompanies.has(id)) ? '비교 불가' : sameBusinessMatch ? '지속' : '신규' };
  });
  const businesses = BUSINESSES.map(business => {
    const items = current.filter(signal => belongsTo(signal, business.companyId));
    const outsideScope = scope !== 'all' && scope !== business.companyId;
    return {
      ...business, signalCount: items.length, sourceCount: sourceCount(items),
      observations: items.length ? items.slice(0, 3).map(signal => `[${signal.id}] ${signal.evidenceType === 'feed-metadata' ? 'RSS 메타데이터·본문 미열람: ' : ''}${signal.summary || signal.title}`) : [outsideScope ? '선택 범위 밖의 사업입니다. 이 브리핑에서 자료를 검토하지 않았습니다.' : '선택 기간에 등록 자료가 없습니다. 시장 변화가 없었다는 뜻은 아닙니다.'],
      implications: items.length ? items.slice(0, 3).map(signal => signal.implication ? `[${signal.id}] 담당자 해석: ${signal.implication}` : `[${signal.id}] 사업 영향 노트 미등록 — 제품·고객·지역별 적용 범위를 확인하세요.`) : [outsideScope ? '그룹 전체 또는 해당 사업 범위를 선택해 별도로 검토하세요.' : '추가 근거를 확보한 뒤 사업 영향을 검토하세요.'],
      evidenceIds: items.map(signal => signal.id),
      status: items.length ? '자료 있음' : '자료 없음',
    };
  });
  const actionItems = [];
  for (const business of BUSINESSES) {
    const items = current.filter(signal => belongsTo(signal, business.companyId));
    if (!items.length) continue;
    const tasks = [];
    for (const signal of items) {
      const followUps = signal.followUp.split(/\r?\n/).map(item => item.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean).slice(0, 2);
      for (const task of followUps) {
        const existing = tasks.find(item => normalizedTitle(item.task) === normalizedTitle(task));
        if (existing) { if (!existing.evidenceIds.includes(signal.id)) existing.evidenceIds.push(signal.id); }
        else tasks.push({ task, evidenceIds: [signal.id] });
      }
    }
    if (!tasks.length) tasks.push({ task: `「${items[0].title}」의 원문·발표일·적용 제품/고객/지역을 확인하고 근거와 담당자 해석을 구분하세요.`, evidenceIds: [items[0].id] });
    for (const [index, task] of tasks.slice(0, 2).entries()) {
      actionItems.push({ id: `action-${business.companyId}-${index + 1}`, companyId: business.companyId, ...task, owner: '미지정', dueDate: null, status: '미착수' });
    }
  }
  const withData = businesses.filter(business => business.signalCount > 0).length;
  const executiveSummary = current.length ? [
    `선택 기간의 등록 자료 ${current.length}건, 서로 다른 발행처/출처 호스트 ${coverage.sourceCount}곳을 검토 범위로 삼았습니다. 전체 시장의 기사 수를 뜻하지 않습니다.`,
    `${scope === 'all' ? `${BUSINESSES.length}개 사업 중 ${withData}개 사업에 기간 내 자료가 있습니다.` : `${BUSINESSES.find(item => item.companyId === scope).label} 범위만 검토했습니다. 다른 사업은 이번 집계의 검토 범위 밖입니다.`} 등록 우선도가 '높음'인 자료는 ${current.filter(signal => signal.impact === '높음').length}건이며 실제 영향도가 검증된 것은 아닙니다.`,
  ] : ['선택 기간에 검토할 근거 자료가 없습니다. 이번 주의 시장 변화·사업 영향을 작성하거나 추정하지 않았습니다.'];
  executiveSummary.push(previous.length
    ? `비교 기간에는 ${previous.length}건의 자료가 있습니다. 이번 기간과의 건수 차이는 제공된 자료량의 차이이며 시장 활동의 증감을 의미하지 않습니다.`
    : '비교 기간 자료가 없어 전주 대비 변화는 비교 불가입니다. 과거 자료를 이번 주 변화로 대체하지 않습니다.');
  const limitations = [
    '등록 문장과 날짜를 규칙으로 정리한 초안입니다. 실시간 기사 수집·원문 사실 검증·미래 전망·LLM 추론을 수행하지 않습니다.',
    '관찰은 등록 요약이고 사업 영향은 담당자가 입력한 해석입니다. 독립적으로 검증한 결론으로 사용하지 마세요.',
    '자료의 발표일로 기간을 구분합니다. 날짜 미등록·유효하지 않은 날짜는 제외했으며 수집일을 발표일로 대신 쓰지 않았습니다.',
    "'신규/지속'은 같은 사업의 비교 기간 자료와 URL·제목을 대조한 표시입니다. 시장 사건의 신규 발생이나 추세 지속을 증명하지 않습니다.",
    '출처 수는 등록된 RSS 발행처명 또는 원문 호스트(주소가 없으면 출처명)를 구분한 값입니다. 기사 수나 독립 검증 횟수가 아닙니다.',
  ];
  if (coverage.feedMetadataCount) limitations.push(`RSS 메타데이터 ${coverage.feedMetadataCount}건이 포함됩니다. 기사 제목·발표일·발행처·피드 설명만 확보했으며 기사 본문은 열람하지 않았고 사실을 독립 검증하지 않았습니다. 사업 태그는 키워드에 따른 참고 분류이며 실제 제품·고객·경쟁 관계가 확인된 것은 아닙니다.`);
  if (!current.length) limitations.push('현재 기간의 근거가 부족합니다. 빈 기간을 가상 사건·과거 기사로 채우지 않았습니다.');
  if (!previous.length) limitations.push('비교 기간의 근거가 없어 전주 대비 판단을 보류했습니다.');
  const noComparison = businesses.filter(item => item.signalCount && !previousCompanies.has(item.companyId)).map(item => item.label);
  if (noComparison.length) limitations.push(`${noComparison.join('·')}은 비교 기간의 같은 사업 자료가 없어 전주 대조가 불가능합니다.`);
  if (includeExamples && current.some(signal => signal.isDemo)) limitations.push('기능 예시가 명시적으로 포함되었습니다. 실제 기사와 구분하고 사업 의사결정의 사실 근거로 사용하지 마세요.');
  if (current.some(signal => !signal.sourceUrl)) limitations.push('원문 URL이 없는 등록 자료가 있습니다. 원문 링크를 확보하기 전에는 근거 확인이 제한됩니다.');
  if (current.some(signal => !BUSINESS_IDS.has(signal.companyId))) limitations.push('기업이 분류되지 않은 자료가 있어 사업별 집계와 후속 액션에서 빠질 수 있습니다.');
  if (coverage.truncatedCount || coverage.previousTruncatedCount) limitations.push(`기간별 최대 ${MAX_RECORDS_PER_PERIOD}건을 등록 우선도·날짜 순으로 검토했습니다. 한도 밖 자료를 포함한 전체 입력을 분석한 것은 아닙니다.`);
  const brief = {
    period: { start: period.start, end: period.end }, previousPeriod, scope,
    generatedAt: asOfISO || null, meetingNotes: '', coverage, executiveSummary, topChanges, businesses, actionItems, limitations,
    sources: current.map(({ id, title, date, sourceName, sourceUrl, isDemo, evidenceType, companyIds }) => ({ id, title, date, sourceName, sourceUrl, isDemo, evidenceType, companyIds })),
  };
  return { ...brief, markdown: weeklyBriefToMarkdown(brief) };
}
