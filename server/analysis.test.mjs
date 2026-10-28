import test from 'node:test';
import assert from 'node:assert/strict';
import { InputError, validateInput, selectSignals, createLocalAnalysis, sourcesText, llmBaseUrl } from './analysis.mjs';

const signal = (overrides = {}) => ({ id: 's1', title: '신규 소재 개발 시나리오', summary: '반도체 공정 소재 기술을 검토하는 예시입니다.', implication: '고객 평가와 기술 성숙도를 확인합니다.', companyId: 'ncchem', sourceName: '공식 사이트', sourceUrl: 'https://example.com/', isDemo: true, ...overrides });

test('input preserves explicit provenance and rejects duplicate IDs', () => {
  const input = validateInput({ question: '기술 영향을 정리해줘', signals: [signal()] });
  assert.equal(input.signals[0].isDemo, true);
  assert.throws(() => validateInput({ question: '질문', signals: [signal(), signal()] }), InputError);
  assert.throws(() => validateInput({ question: '질문', signals: [signal({ isDemo: undefined })] }), InputError);
});

test('input rejects unsafe sources, oversized and malformed requests', () => {
  assert.throws(() => validateInput({ question: '질문', signals: [signal({ sourceUrl: 'javascript:alert(1)' })] }), InputError);
  assert.throws(() => validateInput({ question: '질문', signals: [signal({ sourceUrl: 'https://user:secret@example.com' })] }), InputError);
  assert.throws(() => validateInput({ question: '', signals: [] }), InputError);
  assert.throws(() => validateInput({ question: '질문', signals: Array.from({ length: 41 }, (_, i) => signal({ id: String(i) })) }), InputError);
});

test('company filter and question ranking select relevant evidence', () => {
  const input = validateInput({ question: '규제 동향', company: 'kci', signals: [signal(), signal({ id: 's2', companyId: 'kci', title: '제품 출시', summary: '제품 시장 고객 분석' }), signal({ id: 's3', companyId: 'kci', title: '환경 규제 정책', summary: '규정 인증 검토' })] });
  assert.deepEqual(selectSignals(input).map((item) => item.id), ['s3', 's2']);
});

test('local analysis discloses demo and local mode, retains citations and question', () => {
  const result = createLocalAnalysis(validateInput({ question: '반도체 기술을 정리해줘', signals: [signal()] }));
  assert.equal(result.mode, 'local');
  assert.deepEqual(result.citations, ['s1']);
  assert.match(result.answer, /실제 최신 뉴스가 아닌 데모 시나리오/);
  assert.match(result.answer, /반도체 기술을 정리해줘/);
  assert.match(result.answer, /특허 청구항/);
});

test('registered evidence is not presented as independently verified fact', () => {
  const result = createLocalAnalysis(validateInput({ question: '시장을 분석해줘', signals: [signal({ isDemo: false })] }));
  assert.match(result.answer, /원문과 사실 여부를 별도로 검증하지 않았/);
  assert.match(result.answer, /\[등록 자료\]/);
});

test('briefing and no-evidence responses use appropriate paths', () => {
  const input = validateInput({ signals: [signal()] }, true);
  assert.match(createLocalAnalysis(input).answer, /주간 MI 브리핑/);
  const noEvidence = createLocalAnalysis({ question: '질문', signals: [], company: '' });
  assert.deepEqual(noEvidence.citations, []);
  assert.match(noEvidence.answer, /분석할 자료가 없습니다/);
});

test('LLM endpoint configuration requires credential-free public HTTPS URL', () => {
  assert.equal(llmBaseUrl(), 'https://api.openai.com/v1');
  assert.equal(llmBaseUrl('https://api.example.com/v1/'), 'https://api.example.com/v1');
  for (const url of ['http://api.example.com', 'https://user:secret@example.com', 'https://127.0.0.1/v1', 'https://[::1]/v1', 'https://[2001:db8::1]/v1', 'https://localhost/v1', 'https://model.localhost/v1', 'https://model.internal/v1', 'https://api.example.com?key=secret']) {
    assert.throws(() => llmBaseUrl(url), InputError);
  }
});

test('dates are preserved and invalid calendar dates rejected', () => {
  const input = validateInput({ question: '질문', signals: [signal({ date: '2026-10-28' })] });
  assert.equal(input.signals[0].date, '2026-10-28');
  for (const date of ['2026-02-30', '2026-13-01', '2026-1-2', 'not a date']) {
    assert.throws(() => validateInput({ question: '질문', signals: [signal({ date })] }), InputError);
  }
});

test('weekly period filters inclusively and excludes undated/out-of-range evidence', () => {
  const input = validateInput({ period: { start: '2026-10-22', end: '2026-10-28' }, signals: [signal({ id: 'start', date: '2026-10-22' }), signal({ id: 'end', date: '2026-10-28' }), signal({ id: 'old', date: '2026-10-21' }), signal({ id: 'future', date: '2026-10-29' }), signal({ id: 'undated' })] }, true);
  const result = createLocalAnalysis(input);
  assert.deepEqual(result.citations, ['start', 'end']);
  assert.match(result.answer, /분석 기간: 2026-10-22 ~ 2026-10-28/);
  assert.throws(() => validateInput({ period: { start: '2026-10-28', end: '2026-10-22' }, signals: [] }, true), InputError);
});

test('exportable references contain IDs, dates, source URLs and demo annotations', () => {
  const input = validateInput({ question: '요약', signals: [signal({ date: '2026-10-28' })] });
  const result = createLocalAnalysis(input);
  assert.match(result.answer, /https:\/\/example.com\//);
  assert.match(result.answer, /2026-10-28/);
  assert.match(sourcesText(input.signals), /\[s1\].*예시 시나리오: 실제 뉴스 아님/);
});

test('unsupported financial forecasts and unrelated questions disclose insufficient evidence', () => {
  const input = { signals: [signal({ isDemo: true })] };
  assert.match(createLocalAnalysis(validateInput({ ...input, question: '내년 영업이익 전망' })).answer, /미래 실적·가격·시장 전망을 예측하지 않습니다/);
  assert.match(createLocalAnalysis(validateInput({ ...input, question: '2026년 매출과 영업이익' })).answer, /요청한 재무·시장 수치를 확인할 검증된 자료가 없습니다/);
  assert.match(createLocalAnalysis(validateInput({ ...input, question: '오늘 제주도 날씨는?' })).answer, /이 질문에 직접 답할 근거를 찾지 못했습니다/);
});

test('briefing retains all validated inputs up to40 rather than silently truncating at12', () => {
  const signals = Array.from({ length: 40 }, (_, i) => signal({ id: `s${i}`, date: '2026-10-28' }));
  const input = validateInput({ signals, period: { start: '2026-10-22', end: '2026-10-28' } }, true);
  const result = createLocalAnalysis(input);
  assert.equal(result.citations.length, 40);
  assert.match(result.answer, /\[s39\]/);
  assert.match(result.answer, /전달 자료 40건/);
});

test('RSS metadata provenance and multiple business assignments survive analysis validation', () => {
  const input = validateInput({ question: '시장 동향', company: 'kci', signals: [signal({ id: 'rss', companyId: 'ncchem', companyIds: ['ncchem', 'kci'], evidenceType: 'feed-metadata', isDemo: false })] });
  const result = createLocalAnalysis(input);
  assert.deepEqual(result.citations, ['rss']);
  assert.match(result.answer, /뉴스 피드 메타데이터/);
  assert.match(result.answer, /기사 본문 미열람/);
  assert.ok(!result.answer.includes('사용자 등록: 원문 미검증'));
});
