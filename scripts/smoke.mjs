import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

// Start the app first (npm run dev, or npm run build && npm start).
// BASE_URL=http://127.0.0.1:3001 node scripts/smoke.mjs
// Every run uses a fresh browser context and leaves existing user data untouched.
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:5173';
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
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
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await test('local API is available without spending LLM credits', async () => {
    const response = await context.request.get(`${baseURL}/api/status`);
    assert.equal(response.status(), 200);
    const status = await response.json();
    assert.equal(status.mode, 'local', 'Run smoke checks with MI_LLM_API_KEY unset; this suite verifies local analysis.');
  });

  for (const [label, heading] of pages) {
    await test(`desktop navigation: ${label}`, async () => { await navigate(label, heading); await assertNoOverflow(label); });
  }

  await test('all three business filters constrain feed cards', async () => {
    await navigate('마켓 인텔리전스');
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
    await dialog.getByLabel('핵심 내용', { exact: true }).fill('이 문장은 자동 브라우저 테스트용 등록 자료입니다. 환경 규제와 인증 정책의 적용 지역 및 원문 확인 절차를 검토합니다. 실제 시장 뉴스가 아닙니다.');
    await dialog.getByLabel('출처명', { exact: true }).fill(sourceName);
    await dialog.getByLabel('대상 기업', { exact: true }).fill('E2E 테스트 기업');
    await dialog.getByLabel('원문 URL', { exact: true }).fill(sourceUrl);
    await dialog.getByLabel('원문 발표일', { exact: true }).fill(today);
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
    await visibleDialog().getByRole('button', { name: '닫기', exact: true }).click();
  });

  await test('local Q&A uses registered evidence and source citations', async () => {
    await scopeButton('KCI').click();
    await page.getByRole('button', { name: /^MI 어시스턴트/ }).click();
    const dialog = visibleDialog();
    await dialog.getByRole('textbox', { name: 'MI 분석 질문', exact: true }).fill('환경 규제 정책 관련 자료와 기획 시사점을 정리해줘');
    const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/analyze') && response.request().method() === 'POST');
    await dialog.getByRole('button', { name: '분석 요청', exact: true }).click();
    const response = await responsePromise;
    assert.equal(response.status(), 200);
    const data = await response.json();
    assert.equal(data.mode, 'local');
    assert.ok(data.citations.some((id) => id.startsWith('source-')));
    await dialog.getByText('로컬 근거 요약', { exact: true }).waitFor();
    const answer = await dialog.locator('.report-text').innerText();
    assert.ok(answer.includes(sourceTitle));
    assert.ok(answer.includes(sourceUrl));
    assert.ok(answer.includes('원문 미검증'));
    assert.equal(await dialog.locator('.citation-links').getByRole('link', { name: sourceName, exact: true }).getAttribute('href'), sourceUrl);
    await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  });

  await test('weekly date range includes registered source and Markdown download retains provenance', async () => {
    await navigate('주간 브리핑');
    await page.getByLabel('분석 시작일', { exact: true }).fill(today);
    await page.getByLabel('분석 종료일', { exact: true }).fill(today);
    const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/brief') && response.request().method() === 'POST');
    await page.getByRole('button', { name: '주간 브리핑 생성', exact: true }).click();
    const response = await responsePromise;
    assert.equal(response.status(), 200);
    const request = response.request().postDataJSON();
    assert.deepEqual(request.period, { start: today, end: today });
    assert.ok(request.signals.some((signal) => signal.title === sourceTitle));
    assert.ok(request.signals.every((signal) => signal.date === today));
    await page.locator('.brief-document .report-text').waitFor();
    const text = await page.locator('.brief-document .report-text').innerText();
    assert.ok(text.includes(sourceTitle));
    assert.ok(text.includes(`${today} ~ ${today}`));
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '내보내기', exact: true }).click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'CHEM2-weekly-brief.md');
    const filename = path.join(directory, 'weekly.md');
    await download.saveAs(filename);
    const markdown = await readFile(filename, 'utf8');
    assert.ok(markdown.includes(sourceUrl));
    assert.ok(markdown.includes(sourceTitle));
    assert.ok(markdown.includes(today));
    assert.ok(markdown.includes('원문 미검증'));
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
  await test('browser runtime has no uncaught application errors', async () => { assert.deepEqual(errors, []); });
  console.log(`\n${passed} browser checks passed. Fresh browser context disposed; existing user data unchanged.`);
} catch (error) {
  console.error(`\nFAILED after ${passed} passed checks: ${error.stack || error}`);
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
  await rm(directory, { recursive: true, force: true });
}
