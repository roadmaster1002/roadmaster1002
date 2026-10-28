import { createLocalAnalysis, validateInput } from '../shared/analysis-core.mjs';
import type { Signal } from './data';

export type Analysis = {
  answer: string;
  mode: 'local' | 'llm';
  citations: string[];
};

export type AnalysisStatus = {
  mode: 'local' | 'llm';
  provider: string;
  hosting: 'server' | 'static';
};

export type AnalysisRequest = {
  question?: string;
  company?: string;
  period?: { start: string; end: string };
  signals: Signal[];
};

const staticStatus: AnalysisStatus = {
  mode: 'local',
  provider: '브라우저 내 자료 기반 로컬 분석',
  hosting: 'static',
};

let statusRequest: Promise<AnalysisStatus> | undefined;

function isStaticBuild(): boolean {
  const env = (import.meta as ImportMeta & { env?: { VITE_STATIC_MODE?: string } }).env;
  return env?.VITE_STATIC_MODE === 'true' || window.location.protocol === 'file:';
}

function apiUrl(endpoint: string): URL {
  return new URL(`api/${endpoint}`, document.baseURI);
}

async function discoverStatus(): Promise<AnalysisStatus> {
  if (isStaticBuild()) return staticStatus;
  let response: Response;
  try {
    response = await fetch(apiUrl('status'), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // No API is expected on GitHub Pages or a standalone local HTML file.
    // Once an API has been discovered, analysis errors never take this path.
    return staticStatus;
  }
  if (response.status === 404) return staticStatus;
  if (!response.ok) throw new Error('분석 서버 상태를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  if (!response.headers.get('content-type')?.includes('application/json')) return staticStatus;
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !('mode' in body) || !['local', 'llm'].includes(String(body.mode))) {
    throw new Error('분석 서버가 올바르지 않은 상태 정보를 반환했습니다.');
  }
  return {
    mode: body.mode as 'local' | 'llm',
    provider: 'provider' in body && typeof body.provider === 'string' ? body.provider : '분석 서버',
    hosting: 'server',
  };
}

export function getAnalysisStatus(): Promise<AnalysisStatus> {
  statusRequest ??= discoverStatus().catch(error => {
    statusRequest = undefined;
    throw error;
  });
  return statusRequest;
}

export async function requestAnalysis(body: AnalysisRequest, brief = false): Promise<Analysis> {
  const input = validateInput(body, brief);
  const status = await getAnalysisStatus();
  if (status.hosting === 'static') return createLocalAnalysis(input);

  let response: Response;
  try {
    response = await fetch(apiUrl(brief ? 'brief' : 'analyze'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new Error('분석 서버에 연결하지 못했습니다. 서버 상태를 확인한 뒤 다시 시도해 주세요.');
  }
  let result: unknown;
  try { result = await response.json(); } catch {
    throw new Error('분석 서버의 응답 형식이 올바르지 않습니다.');
  }
  if (!response.ok) {
    const error = result && typeof result === 'object' && 'error' in result && typeof result.error === 'string' ? result.error : '분석 요청을 완료하지 못했습니다.';
    throw new Error(error);
  }
  if (!result || typeof result !== 'object' || !('answer' in result) || typeof result.answer !== 'string' || !('mode' in result) || !['local', 'llm'].includes(String(result.mode)) || !('citations' in result) || !Array.isArray(result.citations) || !result.citations.every(id => typeof id === 'string')) {
    throw new Error('분석 서버가 올바르지 않은 결과를 반환했습니다.');
  }
  return { answer: result.answer, mode: result.mode as Analysis['mode'], citations: result.citations };
}
