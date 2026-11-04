// 여러 화면에서 같이 쓰는 표시 조각
import { MORALE, FAME_STEPS } from './content/stats.js';
import { TRAITS } from './content/traits.js';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 0~200 능력을 별 5개로 (반 개 단위)
export function stars(value, label) {
  const half = Math.round((value / 200) * 10);
  return `<span class="stars" role="img" title="${label ?? ''} 별 ${half / 2}개" aria-label="${label ?? ''} 별 ${half / 2}개"><span class="stars-fill" style="width:${half * 10}%">★★★★★</span>☆☆☆☆☆</span>`;
}

export function moralePill(m) {
  const i = MORALE.indexOf(m);
  const tone = i <= 1 ? 'bad' : i === 2 ? 'warn' : i >= 4 ? 'good' : 'mid';
  return `<span class="pill ${tone}">${m}</span>`;
}

export function needBar(v) {
  const tone = v >= 90 ? 'bad' : v >= 70 ? 'warn' : v >= 40 ? 'mid' : 'ok';
  return `<span class="meter ${tone}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v}"><i style="width:${v}%"></i></span>`;
}

export function statClass(v) { return v >= 15 ? 'st-4' : v >= 11 ? 'st-3' : v >= 7 ? 'st-2' : 'st-1'; }

export function traitBadge(name) {
  const t = TRAITS.find((x) => x.name === name);
  return `<span class="trait r-${t.rarity} t-${t.tone}">${name}</span>`;
}

export function fameStars(exp) {
  const n = FAME_STEPS.filter((x) => exp >= x).length;
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

export const LUCK_COLOR = { 빨: 'var(--luck-1)', 주: 'var(--luck-2)', 노: 'var(--luck-3)', 연: 'var(--luck-4)', 초: 'var(--luck-5)' };
