import { isIP } from 'node:net';
import { InputError } from '../shared/analysis-core.mjs';
export * from '../shared/analysis-core.mjs';

export function llmBaseUrl(value = 'https://api.openai.com/v1') {
  let url;
  try { url = new URL(value); } catch { throw new InputError('MI_LLM_BASE_URL 설정이 올바르지 않습니다.'); }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !hostname.includes('.') || isIP(hostname) || /(?:^|\.)(?:localhost|local|internal|localdomain)$/.test(hostname)) {
    throw new InputError('MI_LLM_BASE_URL은 인증정보 없는 공개 HTTPS 호스트여야 합니다.');
  }
  return url.href.replace(/\/$/, '');
}
