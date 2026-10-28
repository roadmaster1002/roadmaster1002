import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

// These are isolated browser fixtures, never publisher requests or public files.
// Start a Pages-style static server first. BASE_URL and CHROMIUM_PATH are optional.
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173/roadmaster1002/';
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(10000);
const downloads = await mkdtemp(path.join(os.tmpdir(), 'chem2-news-weekly-'));
const errors = [];
const apiRequests = [];
const externalRequests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  const url = new URL(request.url());
  if (/\/api\//.test(url.pathname)) apiRequests.push(url.href);
  if (/^https?:$/.test(url.protocol) && url.origin !== new URL(baseURL).origin) externalRequests.push(url.href);
});

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dateOffset = days => new Date(Date.parse(`${today}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const now = new Date().toISOString();
function article(id, title, date, companyId) {
  return { id, title, sourceName: 'E2E 뉴스 메타데이터', sourceUrl: `https://example.com/fixture/${id}`, publisherUrl: 'https://example.com/', publishedAtISO: `${date}T00:00:00.000Z`, date, companyIds: [companyId], summary: '브라우저 테스트 전용 피드 설명입니다. 실제 기사나 본문 분석을 뜻하지 않습니다.', verification: 'feed-metadata' };
}
const fixtureItems = [
  article('news-test-current-nc', 'E2E 현재 기간 반도체 소재 소식', today, 'ncchem'),
  article('news-test-current-kci', 'E2E 현재 기간 퍼스널케어 원료 소식', dateOffset(-5), 'kci'),
  article('news-test-previous-nc', 'E2E 직전 기간 반도체 자료', dateOffset(-10), 'ncchem'),
  article('news-test-50days', 'E2E 50일 전 퍼스널케어 자료', dateOffset(-50), 'kci'),
  article('news-test-old-2024', 'E2E 2024년 과거 문서', '2024-03-01', 'ncchem'),
  article('news-test-future', 'E2E 미래 날짜의 제외 대상', dateOffset(1), 'ncchem'),
];
const readySnapshot = { schema: 'chem2.news.v1', attemptedAtISO: now, updatedAtISO: now, lastSuccessfulAtISO: now, status: 'ready', items: fixtureItems, sources: [{ companyId: 'ncchem', url: 'https://example.com/feed', status: 'ok', itemCount: fixtureItems.length }], errors: [] };
let responseSnapshot = readySnapshot;
let responseStatus = 200;
let snapshotRequests = 0;
await context.route('**/latest-news.json*', route => {
  snapshotRequests += 1;
  return route.fulfill({ status: responseStatus, contentType: 'application/json', body: JSON.stringify(responseSnapshot) });
});
const legacy = [{ date: now, text: '# E2E 이전 형식 브리핑 보존', scope: '화학2그룹 전체', mode: 'local' }];
await context.addInitScript(value => {
  if (!localStorage.getItem('chem2-e2e-legacy-initialized')) {
    localStorage.setItem('chem2-briefs-v1', JSON.stringify(value));
    localStorage.setItem('chem2-e2e-legacy-initialized', '1');
  }
}, legacy);

let passed = 0;
async function test(name, run) {
  try { await run(); passed += 1; console.log(`PASS ${passed}: ${name}`); }
  catch (error) { error.message = `${name}: ${error.message}`; throw error; }
}
async function navigate(label, mobile = false) {
  if (mobile) await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
  await page.locator('aside nav').getByRole('button', { name: new RegExp(`^${label}`) }).click();
  await page.getByRole('heading', { level: 1, name: label === '대시보드' ? /^더 넓은 시야/ : new RegExp(`^${label}`) }).waitFor();
}
function scope(label) { return page.locator('main .scope-row').getByRole('button', { name: label, exact: true }); }
async function countIs(selector, expected) { await page.waitForFunction(({ selector, expected }) => document.querySelectorAll(selector).length === expected, { selector, expected }); }
async function coverage(current, previous) {
  const cards = page.locator('.weekly-coverage-grid > div');
  assert.equal(await cards.nth(0).locator('strong').innerText(), `${current}건`);
  assert.equal(await cards.nth(1).locator('strong').innerText(), `${previous}건`);
}
async function exportText(buttonName, filename) {
  const promise = page.waitForEvent('download');
  await page.getByRole('button', { name: buttonName, exact: true }).click();
  const result = await promise;
  const file = path.join(downloads, filename);
  await result.saveAs(file);
  return { filename: result.suggestedFilename(), text: await readFile(file, 'utf8') };
}

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await test('latest news is the default MI view and initially shows the seven-day publication window', async () => {
    await navigate('마켓 인텔리전스');
    await scope('그룹 전체').click();
    assert.equal(await page.getByRole('group', { name: 'MI 자료 보기' }).getByRole('button', { name: '최신 뉴스', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('group', { name: '뉴스 발행 기간' }).getByRole('button', { name: '최근 7일', exact: true }).getAttribute('aria-pressed'), 'true');
    await countIs('.latest-card', 2);
    assert.equal(await page.locator('.latest-card-top').getByText('RSS · 본문 미열람', { exact: true }).count(), 2);
    assert.ok((await page.locator('.latest-evidence-note').innerText()).includes('기사 본문은 별도 확인이 필요'));
  });

  await test('30/90-day windows broaden by publication date without promoting 2024 or future records', async () => {
    const windows = page.getByRole('group', { name: '뉴스 발행 기간' });
    await windows.getByRole('button', { name: '최근 30일', exact: true }).click();
    await countIs('.latest-card', 3);
    await windows.getByRole('button', { name: '최근 90일', exact: true }).click();
    await countIs('.latest-card', 4);
    const text = await page.locator('.latest-grid').innerText();
    assert.ok(!text.includes('2024년 과거 문서'));
    assert.ok(!text.includes('미래 날짜의 제외 대상'));
    assert.ok((await page.locator('.latest-exclusions').innerText()).includes('미래 날짜 1건'));
    await windows.getByRole('button', { name: '최근 7일', exact: true }).click();
    await countIs('.latest-card', 2);
  });

  await test('business filters preserve the selected freshness window and a missing business is explicitly empty', async () => {
    await scope('NC Chem').click(); await countIs('.latest-card', 1);
    await scope('KCI').click(); await countIs('.latest-card', 1);
    await scope('Verdant').click(); await countIs('.latest-card', 0);
    await page.getByRole('heading', { name: '최근 7일 조건의 자료가 없습니다.', exact: true }).waitFor();
    assert.ok((await page.locator('.latest-empty').innerText()).includes('시장에 변화가 없었다고 판단할 수 없습니다'));
    await scope('그룹 전체').click(); await countIs('.latest-card', 2);
  });

  await test('reading an RSS link opens a draft without copying feed metadata into an allegedly read article', async () => {
    const card = page.locator('.latest-card').filter({ has: page.getByRole('heading', { name: 'E2E 현재 기간 반도체 소재 소식' }) });
    await card.getByRole('button', { name: '읽은 내용·분석 등록', exact: true }).click();
    const dialog = page.locator('dialog:visible');
    assert.equal(await dialog.getByLabel('제목', { exact: true }).inputValue(), fixtureItems[0].title);
    assert.equal(await dialog.getByLabel(/^핵심 내용/).inputValue(), '');
    assert.equal(await dialog.getByLabel('원문 발표일', { exact: true }).inputValue(), '');
    assert.equal(await dialog.getByLabel('원문 URL', { exact: true }).inputValue(), fixtureItems[0].sourceUrl);
    await dialog.getByRole('button', { name: '취소', exact: true }).click();
  });

  await test('a failed collection snapshot retains the last successful articles and displays the collection failure', async () => {
    responseSnapshot = { ...readySnapshot, status: 'error', attemptedAtISO: new Date().toISOString(), lastSuccessfulAtISO: null, updatedAtISO: null, items: [], errors: ['E2E 발행처 수집 실패: 테스트 응답'] };
    const response = page.waitForResponse(value => value.url().includes('latest-news.json') && value.request().method() === 'GET');
    await page.getByRole('button', { name: '뉴스 갱신 확인', exact: true }).click(); await response;
    await page.getByText('마지막 수집이 실패했습니다. 이전 저장본을 유지합니다.', { exact: true }).waitFor();
    await countIs('.latest-card', 2);
    const cached = await page.evaluate(() => JSON.parse(localStorage.getItem('chem2-public-news-v1')));
    assert.equal(cached.items.length, fixtureItems.length);
    assert.equal(cached.lastSuccessfulAtISO, readySnapshot.lastSuccessfulAtISO);
    assert.equal(cached.status, 'error');
  });

  await test('an HTTP refresh failure keeps prior records and never fills the gap with archived reading candidates', async () => {
    responseStatus = 503;
    const response = page.waitForResponse(value => value.url().includes('latest-news.json'));
    await page.getByRole('button', { name: '뉴스 갱신 확인', exact: true }).click(); await response;
    await page.getByText('뉴스 갱신 파일을 불러오지 못했습니다 (HTTP 503).', { exact: true }).waitFor();
    await countIs('.latest-card', 2);
    assert.equal(await page.locator('.research-card').count(), 0);
    responseStatus = 200; responseSnapshot = readySnapshot;
  });

  await test('weekly calendar presets use Seoul dates and preserve the requested period length', async () => {
    await navigate('주간 브리핑');
    const presets = page.getByRole('group', { name: '브리핑 기간 빠른 선택' });
    const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
    await presets.getByRole('button', { name: '이번 주', exact: true }).click();
    assert.equal(await page.getByLabel('분석 시작일', { exact: true }).inputValue(), dateOffset(-weekday));
    assert.equal(await page.getByLabel('분석 종료일', { exact: true }).inputValue(), today);
    await presets.getByRole('button', { name: '지난주', exact: true }).click();
    assert.equal(await page.getByLabel('분석 시작일', { exact: true }).inputValue(), dateOffset(-weekday - 7));
    assert.equal(await page.getByLabel('분석 종료일', { exact: true }).inputValue(), dateOffset(-weekday - 1));
    await presets.getByRole('button', { name: '최근 7일', exact: true }).click();
    assert.equal(await page.getByLabel('분석 시작일', { exact: true }).inputValue(), dateOffset(-6));
    assert.equal(await page.getByLabel('분석 종료일', { exact: true }).inputValue(), today);
  });

  await test('weekly defaults exclude scenarios and report real current/prior-period evidence coverage and business gaps', async () => {
    await navigate('주간 브리핑');
    await scope('그룹 전체').click();
    assert.equal(await page.getByRole('checkbox', { name: '기능 예시 시나리오 포함', exact: true }).isChecked(), false);
    assert.equal(await page.getByLabel('분석 시작일', { exact: true }).inputValue(), dateOffset(-6));
    assert.equal(await page.getByLabel('분석 종료일', { exact: true }).inputValue(), today);
    await page.getByRole('button', { name: '주간 브리핑 생성', exact: true }).click();
    await page.locator('.weekly-report').waitFor();
    await coverage(2, 1);
    assert.equal(await page.locator('.weekly-changes article').count(), 2);
    assert.equal(await page.locator('.weekly-sources li').count(), 2);
    const verdant = page.locator('.weekly-business-grid > article').filter({ has: page.getByRole('heading', { name: 'Verdant', exact: true }) });
    assert.ok((await verdant.innerText()).includes('자료 없음'));
    assert.ok((await verdant.innerText()).includes('시장 변화가 없었다는 뜻은 아닙니다'));
    assert.ok((await page.locator('.weekly-limitations').innerText()).includes('기사 본문은 열람하지 않았'));
    await page.locator('.weekly-legacy summary').waitFor();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('chem2-briefs-v1'))), legacy);
  });

  const owner = 'E2E 기획 담당자';
  const dueDate = dateOffset(3);
  const meetingNotes = 'E2E 회의 메모: 본문 확인 전 가설이며 적용 제품과 고객 범위를 추가 조사합니다.';
  await test('action owner, due date, status and meeting notes persist across a reload', async () => {
    const action = page.locator('.weekly-action-scroll tbody tr').first();
    await action.getByRole('textbox', { name: / 담당$/ }).fill(owner);
    await action.getByLabel(/ 기한$/).fill(dueDate);
    await action.getByRole('combobox', { name: / 상태$/ }).selectOption('진행 중');
    await page.getByRole('textbox', { name: '주간 브리핑 회의 메모', exact: true }).fill(meetingNotes);
    await page.reload({ waitUntil: 'networkidle' });
    await navigate('주간 브리핑');
    const restored = page.locator('.weekly-action-scroll tbody tr').first();
    assert.equal(await restored.getByRole('textbox', { name: / 담당$/ }).inputValue(), owner);
    assert.equal(await restored.getByLabel(/ 기한$/).inputValue(), dueDate);
    assert.equal(await restored.getByRole('combobox', { name: / 상태$/ }).inputValue(), '진행 중');
    assert.equal(await page.getByRole('textbox', { name: '주간 브리핑 회의 메모', exact: true }).inputValue(), meetingNotes);
  });

  await test('Markdown and action CSV export the current edited report with source evidence', async () => {
    const markdown = await exportText('Markdown 내보내기', 'weekly.md');
    assert.equal(markdown.filename, `MI-weekly-${today}.md`);
    for (const value of [owner, dueDate, '진행 중', meetingNotes, fixtureItems[0].sourceUrl, fixtureItems[1].sourceUrl, '기사 본문 미열람']) assert.ok(markdown.text.includes(value), `Markdown missing ${value}`);
    const csv = await exportText('액션 CSV', 'actions.csv');
    assert.equal(csv.filename, `MI-actions-${today}.csv`);
    for (const value of [owner, dueDate, '진행 중', fixtureItems[0].id, fixtureItems[0].sourceUrl]) assert.ok(csv.text.includes(value), `CSV missing ${value}`);
  });

  await test('unselecting a current source changes the report without dropping the prior-period comparison', async () => {
    await scope('그룹 전체').click();
    const selection = page.locator('.weekly-source-selection');
    await selection.locator('summary').click();
    const source = selection.locator('.weekly-source-checklist label').filter({ hasText: fixtureItems[0].title });
    await source.locator('input').uncheck();
    await page.getByRole('button', { name: '주간 브리핑 생성', exact: true }).click();
    await coverage(1, 1);
    assert.equal(await page.locator('.weekly-sources').getByRole('link', { name: fixtureItems[0].sourceUrl, exact: true }).count(), 0);
    assert.equal(await page.locator('.weekly-sources').getByRole('link', { name: fixtureItems[1].sourceUrl, exact: true }).count(), 1);
  });

  await test('a period with no evidence produces explicit gaps rather than invented changes or actions', async () => {
    await page.getByLabel('분석 시작일', { exact: true }).fill('2000-01-01');
    await page.getByLabel('분석 종료일', { exact: true }).fill('2000-01-07');
    await page.getByRole('button', { name: '주간 브리핑 생성', exact: true }).click();
    await coverage(0, 0);
    assert.equal(await page.locator('.weekly-changes article').count(), 0);
    assert.equal(await page.locator('.weekly-action-scroll tbody tr').count(), 0);
    assert.ok((await page.locator('.weekly-executive').innerText()).includes('시장 변화·사업 영향을 작성하거나 추정하지 않았습니다'));
    assert.equal(await page.getByRole('button', { name: '액션 CSV', exact: true }).isEnabled(), false);
    assert.equal(await page.locator('.weekly-business-grid > article').count(), 3);
    assert.equal(await page.locator('.weekly-sources').count(), 0);
  });

  await test('a future reporting period is rejected without replacing the saved report', async () => {
    const before = await page.getByRole('combobox', { name: '저장된 주간 브리핑', exact: true }).inputValue();
    await page.getByLabel('분석 종료일', { exact: true }).fill(dateOffset(1));
    await page.getByRole('button', { name: '주간 브리핑 생성', exact: true }).click();
    await page.getByRole('alert').getByText('미래 날짜는 주간 실적·동향 브리핑의 분석 기간에 포함할 수 없습니다.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('combobox', { name: '저장된 주간 브리핑', exact: true }).inputValue(), before);
    await coverage(0, 0);
  });

  for (const label of ['대시보드', '산업 지도', '마켓 인텔리전스', '관심 모니터링', '주간 브리핑', '리서치 라이브러리']) {
    await test(`mobile 390px: ${label} remains usable without page overflow`, async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await navigate(label, true);
      const dimensions = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
      assert.ok(dimensions.content <= dimensions.width + 1, `overflow ${dimensions.content} > ${dimensions.width}`);
    });
  }
  await test('no API or publisher is requested and no uncaught runtime error occurs', async () => {
    assert.ok(snapshotRequests >= 4, 'Expected startup, retry and reload snapshot requests.');
    assert.deepEqual(apiRequests, []);
    assert.deepEqual(externalRequests, []);
    assert.deepEqual(errors, []);
  });
  console.log(`\n${passed} latest-news and weekly browser checks passed. Only isolated fixtures were used.`);
} catch (error) {
  console.error(`\nFAILED after ${passed} passed checks: ${error.stack || error}`);
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
  await rm(downloads, { recursive: true, force: true });
}
