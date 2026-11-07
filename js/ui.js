// 여러 화면에서 같이 쓰는 표시 조각
import { MORALE, FAME_STEPS } from './content/stats.js';
import { TRAITS } from './content/traits.js';
import { effectText, isGoodEffect } from './content/persona.js';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 0~200 능력을 별 5개로 (반 개 단위)
export function stars(value, label) {
  const half = Math.round((value / 200) * 10);
  return `<span class="stars" role="img" title="${label ?? ''} 별 ${half / 2}개" aria-label="${label ?? ''} 별 ${half / 2}개"><span class="stars-fill" style="width:${half * 10}%">★★★★★</span>☆☆☆☆☆</span>`;
}

// 사기: FM처럼 원 안의 화살표. 보통은 오른쪽, 좋을수록 위, 나쁠수록 아래를 향하고
// 색은 매우 낮음(빨강)에서 매우 높음(초록)까지 7단계로 바뀐다.
export function moralePill(m) {
  const i = MORALE.indexOf(m);
  // SVG 회전은 시계 방향이 +이므로, 높을수록 음수(위쪽)가 되게 한다.
  const angle = (i - 3) * 30;
  return `<span class="mood" title="사기 ${m}"><svg class="mood-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <circle cx="8" cy="8" r="8" fill="var(--mood-${i})"></circle>
      <g transform="rotate(${-angle} 8 8)"><path d="M3.8 8h7M8.2 4.9 11.3 8l-3.1 3.1" fill="none" stroke="var(--mood-arrow)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path></g>
    </svg><span>${m}</span></span>`;
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

// 교사 프로필 특성 카드
export function traitCards(traits) {
  return `<div class="ptraits">${traits.map((t) => `
    <article class="ptrait"><header><span class="pemoji" aria-hidden="true">${esc(t.emoji)}</span><b>${esc(t.name)}</b></header>
      ${t.desc ? `<p class="note">${esc(t.desc)}</p>` : ''}
      <ul>${t.effects.map((e) => `<li class="${isGoodEffect(e) ? 'good' : e.key === 'catch' ? '' : 'bad'}">${esc(effectText(e))}</li>`).join('')}</ul>
    </article>`).join('')}</div>`;
}
