// 이 브라우저에만 남는 화면 설정 (테마, 글자 크기)
const KEY = 'hanil-manager-settings';
const DEFAULTS = { theme: 'system', textSize: 'normal' };

export function getSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}

export function setSettings(patch) {
  const next = { ...getSettings(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* 저장 못 해도 이번 화면에는 적용 */ }
  applySettings(next);
  return next;
}

export function applySettings(s = getSettings()) {
  const root = document.documentElement;
  if (s.theme === 'system') delete root.dataset.theme; else root.dataset.theme = s.theme;
  root.classList.toggle('text-large', s.textSize === 'large');
}
