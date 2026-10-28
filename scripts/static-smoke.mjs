import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

// Build Pages and serve it without any API. Default path matches GitHub Pages.
// BASE_URL=http://127.0.0.1:4173/roadmaster1002/ node scripts/static-smoke.mjs
// Every run uses a fresh browser context and leaves existing user data untouched.
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/roadmaster1002/';
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const fixtureNow = new Date().toISOString();
await context.route('**/latest-news.json*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ schema: 'chem2.news.v1', attemptedAtISO: fixtureNow, updatedAtISO: fixtureNow, lastSuccessfulAtISO: fixtureNow, status: 'ready', items: [], sources: [], errors: [] }) }));
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
const apiRequests = [];
const externalRequests = [];
page.on('request', request => { const url = new URL(request.url()); if (/^https?:$/.test(url.protocol) && url.origin !== new URL(baseURL).origin) externalRequests.push(url.href); });
page.on('request', request => { if (/\/api\//.test(new URL(request.url()).pathname)) apiRequests.push(request.url()); });
page.on('pageerror', (error) => errors.push(error.message));
const directory = await mkdtemp(path.join(os.tmpdir(), 'chem2-smoke-'));
let passed = 0;

const pages = [
  ['대시보드', '더 넓은 시야, 더 나은 의사결정'],
  ['산업 지도', '산업 지도'],
  ['마켓 인텔리전스', '마켓 인텔리전스'],
  ['관심 모니터링', '관심 모니터링'],
  ['주간 브리핑', '주간 브리핑'],
  ['리서치 라이브러리', '리서치 라이브러리'],
];

async function test(name, run) {
  try {
    await run();
    passed += 1;
    console.log(`PASS ${passed}: ${name}`);
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

async function navigate(label, heading = label, mobile = false) {
  if (mobile) await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
  await page.locator('aside nav').getByRole('button', { name: new RegExp(`^${label}`) }).click();
  await page.getByRole('heading', { level: 1, name: new RegExp(heading) }).waitFor();
}

function scopeButton(label) {
  return page.locator('main .scope-row').getByRole('button', { name: label, exact: true });
}

function visibleDialog() { return page.locator('dialog:visible'); }

async function assertNoOverflow(label) {
  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  assert.ok(dimensions.document <= dimensions.viewport + 1, `${label}: horizontal overflow ${dimensions.document}px > ${dimensions.viewport}px`);
}

const sourceTitle = `E2E 자료 등록 검증 ${Date.now()}`;
const sourceName = 'E2E 테스트 원문';
const sourceUrl = 'https://example.com/chem2-smoke-source';
const sourceNotes = { keyTakeaways: '테스트 논점: 원료 인증의 적용 범위를 구분해야 합니다.', evidence: '테스트 근거: 본문에 등장하는 대상 제품과 적용 조건을 원문 문단으로 대조합니다.', businessImpact: '담당자 검토: 헤어케어 원료의 고객 평가 일정에 미칠 영향을 별도로 검증해야 합니다.', followUp: '후속 조사: 공식 규정 문서와 고객 적용 제품을 비교하고 담당자에게 확인합니다.' };
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await test('static landing page opens directly into the industry map', async () => {
    await page.getByRole('heading', { level: 1, name: /^산업 지도/ }).waitFor();
    assert.equal(await page.locator('.chain-stage').count(), 8);
    await assertNoOverflow('static landing');
  });

  await test('all three industry chains contain meaningful staged process maps', async () => {
    const industries = page.getByRole('group', { name: '산업 선택', exact: true });
    for (const [name, count] of [['삼양엔씨켐', 8], ['삼양KCI', 7], ['Verdant', 7]]) {
      await industries.getByRole('button', { name: new RegExp(name) }).click();
      assert.equal(await page.locator('.chain-stage').count(), count);
      assert.ok(await page.locator('.chain-company.own').count() > 0);
      assert.ok((await page.locator('.chain-data-note').innerText()).includes('공급 관계'));
    }
    await industries.getByRole('button', { name: /삼양엔씨켐/ }).click();
  });

  await test('themes highlight relevant process roles and can be cleared', async () => {
    const themes = page.getByRole('group', { name: '공정 테마', exact: true });
    const selected = themes.getByRole('button').nth(1);
    await selected.click();
    assert.equal(await selected.getAttribute('aria-pressed'), 'true');
    assert.ok(await page.locator('.chain-stage.dimmed').count() > 0);
    await themes.getByRole('button', { name: '전체 공정', exact: true }).click();
    assert.equal(await page.locator('.chain-stage.dimmed').count(), 0);
  });

  await test('company lists expand within a stage when more references exist', async () => {
    const more = page.locator('.chain-more').first();
    assert.ok(await more.count() > 0);
    const column = more.locator('..');
    const before = await column.locator('.chain-company').count();
    await more.click();
    assert.ok(await column.locator('.chain-company').count() > before);
    await column.getByRole('button', { name: '접기', exact: true }).click();
    assert.equal(await column.locator('.chain-company').count(), before);
  });

  for (const [label, heading] of pages) {
    await test(`desktop navigation: ${label}`, async () => { await navigate(label, heading); await assertNoOverflow(label); });
  }


  await test('background reading candidates remain source-pending across businesses', async () => {
    await navigate('마켓 인텔리전스');
    const views = page.getByRole('group', { name: 'MI 자료 보기', exact: true });
    assert.equal(await views.getByRole('button', { name: '최신 뉴스', exact: true }).getAttribute('aria-pressed'), 'true');
    await views.getByRole('button', { name: /^배경 리딩/ }).click();
    for (const [label, company] of [['NC Chem', 'ncchem'], ['KCI', 'kci'], ['Verdant', 'verdant']]) {
      await scopeButton(label).click();
      assert.equal(await page.locator('.research-card').count(), 3);
      assert.equal(await page.locator(`.research-card .company-label.${company}`).count(), 3);
      assert.equal(await page.locator('.research-card-footer').getByText('원문 미검증', { exact: true }).count(), 3);
    }
    await scopeButton('그룹 전체').click();
    assert.equal(await page.locator('.research-card').count(), 9);
    assert.equal(await page.locator('.signal-card').count(), 0);
    assert.ok((await page.locator('.research-access-note').innerText()).includes('기사를 읽고 추출한 사실·요약이 아닙니다'));
  });

  await test('reading guide explains four planning sections and prefills unknown publication dates without inventing facts', async () => {
    await scopeButton('NC Chem').click();
    const card = page.locator('.research-card').filter({ has: page.getByRole('heading', { name: 'ASML Annual Report 2024', exact: true }) });
    const url = await card.getByRole('link', { name: '원문 열기', exact: true }).getAttribute('href');
    await card.getByRole('button', { name: '리딩 가이드', exact: true }).click();
    const guide = visibleDialog();
    await guide.getByRole('heading', { name: '심층 리딩 가이드', exact: true }).waitFor();
    assert.equal(await guide.locator('.research-reader > section').count(), 4);
    assert.equal(await guide.getByRole('link', { name: '원문에서 근거 확인' }).getAttribute('href'), url);
    assert.ok((await guide.locator('.data-notice').innerText()).includes('원문에서 추출한 기사 요약이 아닌'));
    await guide.getByRole('button', { name: '읽은 내용 등록', exact: true }).click();
    const form = visibleDialog();
    await form.getByRole('heading', { name: '리서치 자료 등록', exact: true }).waitFor();
    assert.equal(await form.getByLabel('제목', { exact: true }).inputValue(), 'ASML Annual Report 2024');
    assert.equal(await form.getByLabel('출처명', { exact: true }).inputValue(), 'ASML');
    assert.equal(await form.getByLabel('원문 URL', { exact: true }).inputValue(), url);
    assert.equal(await form.getByLabel(/^핵심 내용/).inputValue(), '');
    assert.equal(await form.getByLabel('원문 발표일', { exact: true }).inputValue(), '');
    assert.ok((await form.getByLabel(/^후속 조사/).inputValue()).length > 0);
    await form.getByRole('button', { name: '취소', exact: true }).click();
    assert.equal(await page.locator('dialog:visible').count(), 0);
  });

  await test('collector JSON import opens a source draft and preserves an explicitly unknown publication date', async () => {
    const fixture = {
      schema: 'chem2.article.v1', companyId: 'verdant', title: 'E2E 수집 파일 형식 검증용 자료',
      publisher: 'E2E 수집 테스트 발행처', url: 'https://www.specialchem.com/test-only-article', publishedDate: null,
      retrievedAtISO: `${today}T01:00:00.000Z`, excerpt: '이 본문은 기사 JSON 가져오기 검증을 위한 합성 테스트 데이터입니다. 실제 발행된 기사가 아니며 사용자의 자료 목록에 등록하지 않습니다. 발표일이 확인되지 않았을 때 날짜를 만들지 않고 비워 두는지 검증합니다.',
      contentHash: 'a'.repeat(64), verification: 'source-read',
      notes: { keyTakeaways: '', evidence: '', businessImpact: '', followUp: '' },
    };
    await page.getByLabel('기사 JSON 파일', { exact: true }).setInputFiles({ name: 'collector-test.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
    const form = visibleDialog();
    await form.getByRole('heading', { name: '리서치 자료 등록', exact: true }).waitFor();
    assert.equal(await form.getByLabel(/^관련 사업/).inputValue(), 'verdant');
    assert.equal(await form.getByLabel('제목', { exact: true }).inputValue(), fixture.title);
    assert.equal(await form.getByLabel('원문 URL', { exact: true }).inputValue(), fixture.url);
    assert.equal(await form.getByLabel(/^핵심 내용/).inputValue(), fixture.excerpt);
    const date = form.getByLabel('원문 발표일', { exact: true });
    assert.equal(await date.inputValue(), '');
    assert.equal(await date.evaluate(input => input.validity.valueMissing), true);
    await date.fill(today);
    assert.equal(await date.evaluate(input => input.validity.valueMissing), false);
    await form.getByRole('button', { name: '취소', exact: true }).click();
    assert.equal(await page.locator('dialog:visible').count(), 0);
    await page.getByLabel('기사 JSON 파일', { exact: true }).setInputFiles({ name: 'wrong-format.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...fixture, schema: 'unknown' })) });
    await page.getByRole('alert').getByText('chem2.article.v1 수집 파일이 아닙니다.', { exact: true }).waitFor();
    assert.equal(await page.locator('dialog:visible').count(), 0);
  });

  await test('all three business filters constrain feed cards', async () => {
    await navigate('마켓 인텔리전스');
    await page.getByRole('group', { name: 'MI 자료 보기' }).getByRole('button', { name: /^기능 예시/ }).click();
    for (const [label, company] of [['NC Chem', 'ncchem'], ['KCI', 'kci'], ['Verdant', 'verdant']]) {
      await scopeButton(label).click();
      const count = await page.locator('.signal-card').count();
      assert.ok(count > 0, `No signals for ${label}`);
      assert.equal(await page.locator(`.signal-card .company-label.${company}`).count(), count);
    }
    await scopeButton('그룹 전체').click();
  });

  await test('industry process map explains stages, company business models and cross-industry search', async () => {
    await navigate('산업 지도');
    const industries = page.getByRole('group', { name: '산업 선택', exact: true });
    await industries.getByRole('button', { name: /삼양엔씨켐/ }).click();
    assert.equal(await page.locator('.chain-stage').count(), 8);
    const process = page.locator('.chain-stage').nth(1);
    const processName = await process.locator('strong').innerText();
    await process.click();
    assert.ok((await page.locator('.stage-explainer h3').innerText()).includes(processName));
    assert.equal(await page.locator('.input-output > div').count(), 3);
    const participant = page.locator('.chain-company').first();
    const companyName = (await participant.locator('.chain-company-name').innerText()).replace('OUR BUSINESS', '').trim();
    await participant.click();
    const detail = page.getByRole('dialog', { name: '기업의 역할과 사업 구조', exact: true });
    await detail.getByRole('heading', { name: companyName, exact: true }).waitFor();
    assert.ok((await detail.locator('.earnings-logic').innerText()).includes('일반적인 사업 모델'));
    assert.match(await detail.getByRole('link', { name: '공식 자료 확인' }).getAttribute('href'), /^https:\/\//);
    await detail.getByRole('button', { name: '기업 상세 닫기' }).click();
    const search = page.getByRole('textbox', { name: '산업 전체 기업 검색', exact: true });
    await search.fill('삼양KCI');
    const result = page.locator('.chain-search-results > div').last().getByRole('button').first();
    await result.click();
    await detail.getByRole('heading', { name: '삼양KCI', exact: true }).waitFor();
    await detail.getByRole('button', { name: '기업 상세 닫기' }).click();
    assert.equal(await industries.getByRole('button', { name: /삼양KCI/ }).getAttribute('aria-pressed'), 'true');
    await search.fill('__no_company_matches_this__');
    await page.getByText('해당 기업이나 제품이 아직 등록되지 않았습니다. 다른 검색어를 입력해 주세요.', { exact: true }).waitFor();
    await page.getByRole('button', { name: '기업 검색 지우기' }).click();
  });

  let savedTitle;
  await test('signal bookmarks persist across reload and appear in library', async () => {
    await navigate('마켓 인텔리전스');
    await page.getByRole('group', { name: 'MI 자료 보기' }).getByRole('button', { name: /^기능 예시/ }).click();
    await scopeButton('그룹 전체').click();
    const article = page.locator('.signal-card').first();
    savedTitle = await article.getByRole('heading', { level: 3 }).innerText();
    await article.getByRole('button', { name: `${savedTitle} 저장`, exact: true }).click();
    await page.reload({ waitUntil: 'networkidle' });
    await navigate('리서치 라이브러리');
    await scopeButton('그룹 전체').click();
    await page.getByRole('heading', { level: 3, name: savedTitle, exact: true }).waitFor();
    await page.getByRole('button', { name: `${savedTitle} 저장 취소`, exact: true }).waitFor();
  });

  await test('register source with metadata and retain it after reload', async () => {
    await page.getByRole('button', { name: '자료 등록', exact: true }).click();
    const dialog = visibleDialog();
    await dialog.getByRole('heading', { name: '리서치 자료 등록', exact: true }).waitFor();
    await dialog.getByLabel('관련 사업').selectOption('kci');
    await dialog.getByLabel('유형').selectOption('규제·정책');
    await dialog.getByLabel('제목', { exact: true }).fill(sourceTitle);
    await dialog.getByLabel(/^핵심 내용/).fill('이 문장은 자동 브라우저 테스트용 등록 자료입니다. 환경 규제와 인증 정책의 적용 지역 및 원문 확인 절차를 검토합니다. 실제 시장 뉴스가 아닙니다.');
    await dialog.getByLabel('출처명', { exact: true }).fill(sourceName);
    await dialog.getByLabel('대상 기업', { exact: true }).fill('E2E 테스트 기업');
    await dialog.getByLabel('원문 URL', { exact: true }).fill(sourceUrl);
    await dialog.getByLabel('원문 발표일', { exact: true }).fill(today);
    await dialog.getByLabel(/^핵심 논점/).fill(sourceNotes.keyTakeaways);
    await dialog.getByLabel(/^근거·수치·조건/).fill(sourceNotes.evidence);
    await dialog.getByLabel(/^사업 영향 · 담당자 분석/).fill(sourceNotes.businessImpact);
    await dialog.getByLabel(/^후속 조사/).fill(sourceNotes.followUp);
    await dialog.getByRole('button', { name: '자료 등록', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.reload({ waitUntil: 'networkidle' });
    await navigate('리서치 라이브러리');
    await scopeButton('그룹 전체').click();
    await page.getByRole('button', { name: /^등록한 자료/ }).click();
    await page.getByRole('heading', { level: 3, name: sourceTitle, exact: true }).waitFor();
    await page.getByRole('button', { name: new RegExp(sourceTitle) }).filter({ has: page.getByRole('heading', { level: 3, name: sourceTitle, exact: true }) }).click();
    await visibleDialog().getByRole('link', { name: '원문 확인' }).waitFor();
    assert.equal(await visibleDialog().getByRole('link', { name: '원문 확인' }).getAttribute('href'), sourceUrl);
    assert.equal(await visibleDialog().locator('section.article-review-note').count(), 4);
    for (const note of Object.values(sourceNotes)) assert.ok((await visibleDialog().locator('.signal-detail').innerText()).includes(note));
    await visibleDialog().getByRole('button', { name: '닫기', exact: true }).click();
  });

  await test('local Q&A uses registered evidence and source citations', async () => {
    await scopeButton('KCI').click();
    await page.getByRole('button', { name: /^MI 어시스턴트/ }).click();
    const dialog = visibleDialog();
    await dialog.getByRole('textbox', { name: 'MI 분석 질문', exact: true }).fill('환경 규제 정책 관련 자료와 기획 시사점을 정리해줘');
    await dialog.getByRole('button', { name: '분석 요청', exact: true }).click();
    await dialog.getByText('로컬 근거 요약', { exact: true }).waitFor();
    const answer = await dialog.locator('.report-text').innerText();
    assert.ok(answer.includes(sourceTitle));
    assert.ok(answer.includes(sourceNotes.businessImpact));
    assert.ok(answer.includes(sourceUrl));
    assert.ok(answer.includes('원문 미검증'));
    assert.equal(await dialog.locator('.citation-links').getByRole('link', { name: sourceName, exact: true }).getAttribute('href'), sourceUrl);
    await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  });

  await test('structured weekly date range includes registered notes and Markdown download retains provenance', async () => {
    await navigate('주간 브리핑');
    await page.getByLabel('분석 시작일', { exact: true }).fill(today);
    await page.getByLabel('분석 종료일', { exact: true }).fill(today);
    assert.equal(await page.getByRole('checkbox', { name: '기능 예시 시나리오 포함', exact: true }).isChecked(), false);
    await page.getByRole('button', { name: '주간 브리핑 생성', exact: true }).click();
    await page.locator('.weekly-report').waitFor();
    const text = await page.locator('.weekly-report').innerText();
    assert.ok(text.includes(sourceTitle));
    assert.ok(text.includes(`${today} — ${today}`));
    assert.ok(text.includes(sourceNotes.businessImpact));
    assert.equal(await page.locator('.weekly-coverage-grid > div').nth(0).locator('strong').innerText(), '1건');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Markdown 내보내기', exact: true }).click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), `MI-weekly-${today}.md`);
    const filename = path.join(directory, 'weekly.md');
    await download.saveAs(filename);
    const markdown = await readFile(filename, 'utf8');
    assert.ok(markdown.includes(sourceUrl));
    assert.ok(markdown.includes(sourceTitle));
    assert.ok(markdown.includes(sourceNotes.businessImpact));
    assert.ok(markdown.includes(today));
    assert.ok(markdown.includes('등록 자료: 독립 사실 검증 안 됨'));
    assert.ok(markdown.includes('source-'));
  });

  await test('watch topic switch retains its state across reload', async () => {
    await navigate('관심 모니터링');
    await scopeButton('그룹 전체').click();
    const toggle = page.getByRole('switch').first();
    const label = await toggle.getAttribute('aria-label');
    const checked = await toggle.getAttribute('aria-checked');
    await toggle.click();
    const next = checked === 'true' ? 'false' : 'true';
    assert.equal(await toggle.getAttribute('aria-checked'), next);
    await page.reload({ waitUntil: 'networkidle' });
    await navigate('관심 모니터링');
    await scopeButton('그룹 전체').click();
    assert.equal(await page.getByRole('switch', { name: label, exact: true }).getAttribute('aria-checked'), next);
  });

  await page.setViewportSize({ width: 390, height: 844 });
  for (const [label, heading] of pages) {
    await test(`390px mobile navigation and no page overflow: ${label}`, async () => {
      await navigate(label, heading, true);
      await assertNoOverflow(label);
      assert.ok(!(await page.locator('aside.sidebar').evaluate((element) => element.classList.contains('open'))), 'Mobile menu remains open after navigation');
    });
  }
  await test('static build never requests a server API', async () => { assert.deepEqual(apiRequests, []); });
  await test('reading candidates and source imports do not fetch article publishers', async () => { assert.deepEqual(externalRequests, []); });
  await test('browser runtime has no uncaught application errors', async () => { assert.deepEqual(errors, []); });
  console.log(`\n${passed} static browser checks passed. Fresh browser context disposed; existing user data unchanged.`);
} catch (error) {
  console.error(`\nFAILED after ${passed} passed checks: ${error.stack || error}`);
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
  await rm(directory, { recursive: true, force: true });
}
