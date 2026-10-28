import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWeeklyBrief, weeklyBriefToMarkdown, WeeklyBriefError } from '../shared/weekly-brief.mjs';

const period = { start: '2026-10-22', end: '2026-10-28' };
const signal = (overrides = {}) => ({
  id: 'current', title: '고객 공정용 소재 기술 발표', companyId: 'ncchem',
  date: '2026-10-28', summary: '등록자가 요약한 공개 자료의 관찰입니다.',
  implication: '담당자가 적용 고객과 평가 조건을 추가 확인하도록 제안했습니다.',
  sourceName: '공식 뉴스룸', sourceUrl: 'https://example.com/news/material',
  isDemo: false, impact: '보통', category: '기술·특허', ...overrides,
});

test('weekly boundaries are inclusive and old/future/undated/example records do not become current evidence', () => {
  const result = buildWeeklyBrief({ period, signals: [
    signal({ id: 'start', title: '시작일 자료', date: '2026-10-22' }),
    signal({ id: 'end', title: '종료일 자료' }),
    signal({ id: 'old', title: '오래된 자료', date: '2024-10-28' }),
    signal({ id: 'future', title: '미래 자료', date: '2026-10-29' }),
    signal({ id: 'undated', date: '' }), signal({ id: 'invalid', date: '2026-02-30' }),
    signal({ id: 'demo', title: '가상 시나리오', isDemo: true }),
  ] });
  assert.deepEqual(result.sources.map(item => item.id), ['end', 'start']);
  assert.equal(result.coverage.currentCount, 2);
  assert.equal(result.coverage.excludedOutsidePeriodCount, 2);
  assert.equal(result.coverage.undatedCount, 2);
  assert.equal(result.coverage.excludedDemoCount, 1);
  assert.ok(!result.markdown.includes('오래된 자료'));
  assert.ok(!result.markdown.includes('가상 시나리오'));
});

test('comparison period shifts by the same inclusive length across month and year boundaries', () => {
  assert.deepEqual(buildWeeklyBrief({ period, signals: [] }).previousPeriod, { start: '2026-10-15', end: '2026-10-21' });
  assert.deepEqual(buildWeeklyBrief({ period: { start: '2026-01-01', end: '2026-01-07' }, signals: [] }).previousPeriod, { start: '2025-12-25', end: '2025-12-31' });
  assert.deepEqual(buildWeeklyBrief({ period: { start: '2024-03-01', end: '2024-03-01' }, signals: [] }).previousPeriod, { start: '2024-02-29', end: '2024-02-29' });
});

test('deduplication removes tracking URL copies but preserves different stories on the same homepage', () => {
  const result = buildWeeklyBrief({ period, signals: [
    signal({ id: 'a', title: '동일한 기사', sourceUrl: 'https://www.example.com/news/material/?utm_source=mail#top' }),
    signal({ id: 'b', title: '동일한   기사', sourceUrl: 'https://example.com/news/material' }),
    signal({ id: 'c', title: '첫 번째 별도 기사', sourceUrl: 'https://example.com/' }),
    signal({ id: 'd', title: '두 번째 별도 기사', sourceUrl: 'https://example.com/' }),
  ] });
  assert.equal(result.coverage.currentCount, 3);
  assert.equal(result.coverage.duplicateCount, 1);
  assert.equal(result.coverage.sourceCount, 1);
});

test('business scope restricts evidence while all three business coverage rows remain explicit', () => {
  const result = buildWeeklyBrief({ period, company: 'kci', signals: [signal(), signal({ id: 'kci', title: '케어 원료', companyId: 'kci' }), signal({ id: 'verdant', title: '계면활성제', companyId: 'verdant' })] });
  assert.equal(result.scope, 'kci');
  assert.deepEqual(result.sources.map(item => item.id), ['kci']);
  assert.equal(result.businesses.length, 3);
  assert.equal(result.businesses.find(item => item.companyId === 'ncchem').status, '자료 없음');
  assert.equal(result.businesses.find(item => item.companyId === 'kci').status, '자료 있음');
  assert.equal(result.actionItems[0].companyId, 'kci');
});

test('empty evidence is a valid brief that discloses missing data without fabricated market conclusions', () => {
  const result = buildWeeklyBrief({ period, signals: [signal({ date: '2023-10-13', title: '과거 발표' })] });
  assert.equal(result.coverage.currentCount, 0);
  assert.deepEqual(result.topChanges, []);
  assert.deepEqual(result.actionItems, []);
  assert.deepEqual(result.sources, []);
  assert.ok(result.businesses.every(item => item.status === '자료 없음'));
  assert.match(result.executiveSummary.join(' '), /추정하지 않았습니다/);
  assert.match(result.markdown, /자료가 없다는 이유로 시장 변화가 없었다고 판단할 수 없습니다/);
  assert.ok(!result.markdown.includes('과거 발표'));
});

test('examples require opt-in and stay labeled as fictional evidence', () => {
  const inputs = { period, signals: [signal({ isDemo: true })] };
  assert.equal(buildWeeklyBrief(inputs).coverage.currentCount, 0);
  const result = buildWeeklyBrief({ ...inputs, includeExamples: true });
  assert.equal(result.coverage.currentCount, 1);
  assert.equal(result.sources[0].isDemo, true);
  assert.match(result.markdown, /기능 예시: 실제 기사 아님/);
  assert.match(result.limitations.join(' '), /기능 예시가 명시적으로 포함/);
});

test('comparison is unavailable without same-business prior evidence and never assumes that missing prior data is zero activity', () => {
  const result = buildWeeklyBrief({ period, signals: [signal(), signal({ id: 'kci-now', title: '케어 신호', companyId: 'kci' })], previousSignals: [signal({ id: 'kci-prior', title: '전주 다른 케어 기사', companyId: 'kci', date: '2026-10-21' })] });
  assert.equal(result.coverage.previousCount, 1);
  assert.equal(result.topChanges.find(item => item.companyId === 'ncchem').comparison, '비교 불가');
  assert.equal(result.topChanges.find(item => item.companyId === 'kci').comparison, '신규');
  assert.match(result.limitations.join(' '), /삼양엔씨켐은 비교 기간/);
  const withoutPrior = buildWeeklyBrief({ period, signals: [signal()] });
  assert.ok(withoutPrior.topChanges.every(item => item.comparison === '비교 불가'));
  assert.match(withoutPrior.executiveSummary.join(' '), /이번 주 변화로 대체하지 않습니다/);
});

test('continued label only follows an exact prior URL and headline match; counts are not treated as trends', () => {
  const result = buildWeeklyBrief({ period, signals: [signal()], previousSignals: [signal({ id: 'previous', date: '2026-10-18' })] });
  assert.equal(result.topChanges[0].comparison, '지속');
  assert.match(result.limitations.join(' '), /시장 사건의 신규 발생이나 추세 지속을 증명하지 않습니다/);
  assert.match(result.executiveSummary.join(' '), /시장 활동의 증감을 의미하지 않습니다/);
});

test('top five prioritize supplied impact then date without creating scores or market-share numbers', () => {
  const result = buildWeeklyBrief({ period, signals: [
    signal({ id: 'normal-new', title: '보통 신규', impact: '보통' }),
    signal({ id: 'high-old', title: '높음 이전', impact: '높음', date: '2026-10-23' }),
    signal({ id: 'high-new', title: '높음 신규', impact: '높음' }),
    ...Array.from({ length: 5 }, (_, i) => signal({ id: `low${i}`, title: `낮음 ${i}`, impact: '낮음' })),
  ] });
  assert.deepEqual(result.topChanges.slice(0, 3).map(item => item.id), ['high-new', 'high-old', 'normal-new']);
  assert.equal(result.topChanges.length, 5);
  assert.equal(result.sources.length, 8);
  assert.ok(!result.markdown.includes('%'));
  assert.ok(!('score' in result.topChanges[0]));
});

test('analyst follow-up notes become evidence-linked actions with no invented owners or deadlines', () => {
  const result = buildWeeklyBrief({ period, signals: [
    signal({ articleDetails: { notes: { followUp: '• 고객 평가 조건 확인\n- 원문 발표일 대조\n추가 세 번째 과제' } } }),
    signal({ id: 'kci', companyId: 'kci', title: '퍼스널케어 자료' }),
    signal({ id: 'verdant', companyId: 'verdant', title: '계면활성제 자료' }),
  ] });
  assert.deepEqual(result.actionItems.filter(item => item.companyId === 'ncchem').map(item => item.task), ['고객 평가 조건 확인', '원문 발표일 대조']);
  assert.ok(result.actionItems.every(item => item.owner === '미지정' && item.dueDate === null && item.status === '미착수'));
  assert.ok(result.actionItems.every(item => item.evidenceIds.length > 0));
  assert.ok(result.actionItems.length <= 6);
});

test('export preserves source IDs/URLs/date, analyst context and all three business rows', () => {
  const result = buildWeeklyBrief({ period, signals: [signal()], asOfISO: '2026-10-28T08:30:00Z' });
  assert.equal(result.generatedAt, '2026-10-28T08:30:00Z');
  assert.match(result.markdown, /https:\/\/example.com\/news\/material/);
  assert.match(result.markdown, /\[current\]/);
  assert.match(result.markdown, /2026-10-28/);
  assert.match(result.markdown, /담당자가 적용 고객과 평가 조건/);
  for (const name of ['삼양엔씨켐', '삼양KCI', 'Verdant']) assert.ok(result.markdown.includes(name));
  assert.match(result.markdown, /독립 사실 검증 안 됨/);
});

test('input records are not mutated; period, provenance and unsafe URLs are handled explicitly', () => {
  const inputs = { period: { ...period }, signals: [signal({ sourceUrl: 'javascript:alert(1)' })] };
  const copy = structuredClone(inputs);
  const result = buildWeeklyBrief(inputs);
  assert.deepEqual(inputs, copy);
  assert.equal(result.sources[0].sourceUrl, '');
  assert.match(result.limitations.join(' '), /원문 URL이 없는/);
  assert.throws(() => buildWeeklyBrief({ period: { start: '2026-02-30', end: '2026-03-02' }, signals: [] }), WeeklyBriefError);
  assert.throws(() => buildWeeklyBrief({ period: { start: '2026-10-28', end: '2026-10-22' }, signals: [] }), WeeklyBriefError);
  assert.throws(() => buildWeeklyBrief({ period, signals: [signal({ isDemo: undefined })] }), WeeklyBriefError);
});

test('record limits are disclosed instead of silently claiming all submitted evidence was reviewed', () => {
  const result = buildWeeklyBrief({ period, signals: Array.from({ length: 43 }, (_, i) => signal({ id: `s${i}`, title: `개별 자료 ${i}` })) });
  assert.equal(result.coverage.currentCount, 40);
  assert.equal(result.coverage.truncatedCount, 3);
  assert.match(result.limitations.join(' '), /전체 입력을 분석한 것은 아닙니다/);
});


test('multi-business RSS evidence is counted once globally and appears in each relevant business', () => {
  const shared = signal({ id: 'shared', companyId: 'kci', companyIds: ['kci', 'verdant'], evidenceType: 'feed-metadata' });
  const result = buildWeeklyBrief({ period, signals: [shared] });
  assert.equal(result.coverage.currentCount, 1);
  assert.equal(result.sources.length, 1);
  assert.equal(result.coverage.feedMetadataCount, 1);
  assert.equal(result.businesses.find(item => item.companyId === 'kci').signalCount, 1);
  assert.equal(result.businesses.find(item => item.companyId === 'verdant').signalCount, 1);
  assert.equal(buildWeeklyBrief({ period, company: 'verdant', signals: [shared] }).coverage.currentCount, 1);
  assert.match(result.limitations.join(' '), /기사 본문은 열람하지 않았/);
  assert.match(result.limitations.join(' '), /사업 태그는 키워드/);
  assert.match(result.markdown, /RSS 메타데이터: 기사 본문 미열람/);
});

test('edited action assignments, dates, statuses and meeting notes are exported from the current report', () => {
  const result = buildWeeklyBrief({ period, signals: [signal()] });
  result.actionItems[0].owner = '기획 담당자';
  result.actionItems[0].dueDate = '2026-10-30';
  result.actionItems[0].status = '진행 중';
  result.meetingNotes = '고객 평가 자료를 다음 회의 전에 확인하기로 결정했습니다.';
  const markdown = weeklyBriefToMarkdown(result);
  assert.match(markdown, /기획 담당자/);
  assert.match(markdown, /2026-10-30/);
  assert.match(markdown, /진행 중/);
  assert.match(markdown, /고객 평가 자료를 다음 회의/);
});


test('duplicate source rows merge business assignments without multiplying the evidence count', () => {
  const result = buildWeeklyBrief({ period, signals: [signal({ id: 'kci-copy', companyId: 'kci' }), signal({ id: 'verdant-copy', companyId: 'verdant' })] });
  assert.equal(result.coverage.currentCount, 1);
  assert.equal(result.coverage.duplicateCount, 1);
  assert.equal(result.businesses.find(item => item.companyId === 'kci').signalCount, 1);
  assert.equal(result.businesses.find(item => item.companyId === 'verdant').signalCount, 1);
  assert.deepEqual(new Set(result.sources[0].companyIds), new Set(['kci', 'verdant']));
});


test('a source previously classified only under another business is not called continued for the selected business', () => {
  const result = buildWeeklyBrief({ period, signals: [signal({ companyId: 'kci' })], previousSignals: [signal({ id: 'old-nc', companyId: 'ncchem', date: '2026-10-18' }), signal({ id: 'old-kci', companyId: 'kci', title: '다른 케어 기사', date: '2026-10-19' })] });
  assert.equal(result.topChanges[0].comparison, '신규');
});


test('asOfISO rejects future periods using the Seoul calendar day, including timezone boundaries', () => {
  const input = { period, signals: [signal({ date: '2026-10-28' })] };
  assert.throws(() => buildWeeklyBrief({ ...input, asOfISO: '2026-10-27T14:59:59Z' }), error => error instanceof WeeklyBriefError && /미래 날짜/.test(error.message) && /2026-10-27/.test(error.message));
  const midnightSeoul = buildWeeklyBrief({ ...input, asOfISO: '2026-10-27T15:00:00Z' });
  assert.equal(midnightSeoul.coverage.currentCount, 1);
  assert.throws(() => buildWeeklyBrief({ period: { start: '2026-10-22', end: '2026-10-29' }, signals: [signal({ date: '2026-10-29' })], asOfISO: '2026-10-28T08:00:00Z' }), WeeklyBriefError);
  assert.equal(buildWeeklyBrief(input).coverage.currentCount, 1, 'Omitting the optional clock keeps deterministic historical use unchanged.');
});

test('Google News metadata counts actual publisher labels instead of collapsing all sources to the aggregator host', () => {
  const result = buildWeeklyBrief({ period, signals: [
    signal({ id: 'feed-a', title: '발행처A 첫 기사', evidenceType: 'feed-metadata', sourceName: 'Publisher A', sourceUrl: 'https://news.google.com/rss/articles/one' }),
    signal({ id: 'feed-b', title: '발행처B 기사', evidenceType: 'feed-metadata', sourceName: 'Publisher B', sourceUrl: 'https://news.google.com/rss/articles/two' }),
    signal({ id: 'feed-c', title: '발행처A 다른 기사', evidenceType: 'feed-metadata', sourceName: ' Publisher   A ', sourceUrl: 'https://news.google.com/rss/articles/three' }),
  ], previousSignals: [signal({ id: 'feed-old', title: '전주 발행처C 기사', date: '2026-10-18', evidenceType: 'feed-metadata', sourceName: 'Publisher C', sourceUrl: 'https://news.google.com/rss/articles/old' })] });
  assert.equal(result.coverage.currentCount, 3);
  assert.equal(result.coverage.sourceCount, 2);
  assert.equal(result.coverage.previousSourceCount, 1);
  assert.equal(result.businesses.find(item => item.companyId === 'ncchem').sourceCount, 2);
  assert.match(result.limitations.join(' '), /RSS 발행처명/);
});
