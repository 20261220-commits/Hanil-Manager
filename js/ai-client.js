// AI 중계 서버와 이야기하는 부분. 키는 서버에만 있고 여기에는 없다.
import { AI_SERVER } from './config.js';
import { getSettings } from './settings.js';

export const serverUrl = () => (getSettings().aiServer || AI_SERVER || '').trim().replace(/\/+$/, '');
export const aiEnabled = () => !!serverUrl();

async function call(path, body, { method = 'POST', timeout = 30000 } = {}) {
  const base = serverUrl();
  if (!base) throw new Error('AI 서버 주소가 없습니다.');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${base}${path}`, {
      method,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'X-Friend-Code': getSettings().friendCode || '' },
      body: method === 'POST' ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `서버 오류 (${res.status})`);
    return data;
  } catch (err) {
    throw new Error(err.name === 'AbortError' ? 'AI 서버가 응답하지 않습니다.' : err.message);
  } finally {
    clearTimeout(timer);
  }
}

export const checkServer = () => call('/health', null, { method: 'GET', timeout: 10000 });
export const aiProfile = (text, name, subject) => call('/profile', { text, name, subject });
export const aiEvent = (bio, traits, week) => call('/event', { bio, traits: traits.map((t) => ({ name: t.name, desc: t.desc })), week });
