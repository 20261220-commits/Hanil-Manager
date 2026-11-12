// 화면 위쪽 게임 바(주차·AP·피로·예산·신임·다음 주로)와 알림
import { getState, unreadCount } from './game/state.js';
import { endWeek } from './game/turn.js';
import { deliverPersonaEvent } from './game/persona.js';
import { electionOpen } from './game/election.js';
import { ensureExam, isExamWeek } from './game/exam.js';
import { yearTurn } from './game/calendar.js';

let toastTimer = null;

export function toast(text, bad = false) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.toggle('bad', bad);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3800);
}

// 행동 결과를 알리고 화면을 다시 그린다.
export function notify(result) {
  toast(result.msg, !result.ok);
  window.dispatchEvent(new CustomEvent('game:changed'));
}

export function renderGamebar() {
  const s = getState();
  const bar = document.getElementById('gamebar');
  const dots = Array.from({ length: Math.max(s.apMax, s.ap) }, (_, i) => `<i class="${i < s.ap ? 'on' : ''}"></i>`).join('');
  const fatTone = s.fatigue >= 70 ? 'bad' : s.fatigue >= 50 ? 'warn' : '';
  bar.innerHTML = `
    <span class="gb-week">${s.weekLabel}</span>
    <span class="gb-item" title="행동력: 이번 주에 남은 AP"><span class="lbl">AP</span><span class="dots" aria-label="AP ${s.ap}">${dots}</span><b>${s.ap}</b></span>
    <span class="gb-item ${fatTone}" title="피로도: 50 이상이면 교사 능력치가 떨어지고 100이면 병가"><span class="lbl">피로</span><b>${s.fatigue}</b></span>
    <span class="gb-item" title="예산 (만원)"><span class="lbl">예산</span><b>${s.budget}</b></span>
    <span class="gb-item" title="교장 신임 (0이 되면 전근 발령)"><span class="lbl">신임</span><b>${s.trust}</b></span>
    <button type="button" class="btn primary gb-next" id="next-week">다음 주로 ▶</button>`;
  bar.querySelector('#next-week').addEventListener('click', () => {
    const r = endWeek();
    if (!r.ok) { toast(r.msg, true); location.hash = s.duel && !s.duel.m.done ? `duel-${s.duel.classId}` : 'inbox'; return; }
    toast(r.msg);
    deliverPersonaEvent(); // 프로필 이벤트가 예약됐으면 만들어 편지함에 넣는다 (AI는 몇 초 걸릴 수 있음)
    if (location.hash === '#inbox') window.dispatchEvent(new CustomEvent('game:changed'));
    else location.hash = 'inbox';
  });

  document.getElementById('who').textContent = `${s.profile.title} ${s.profile.name} 선생님`;

  // 반장 선거 메뉴는 선거 기간에만, 시험 메뉴는 시험 주에 강조
  const el = document.getElementById('nav-election');
  if (el) el.hidden = !electionOpen(s);
  const ex = document.querySelector('.sidenav a[data-section="exam"]');
  if (ex) ex.classList.toggle('hot', isExamWeek(s, ensureExam(s)));
  const mtNav = document.getElementById('nav-meeting');
  if (mtNav) { mtNav.hidden = yearTurn(s.turn) < 41; mtNav.classList.toggle('hot', yearTurn(s.turn) === 48); }
  const n = unreadCount();
  const count = document.getElementById('inbox-count');
  count.textContent = n;
  count.hidden = n === 0;
}
