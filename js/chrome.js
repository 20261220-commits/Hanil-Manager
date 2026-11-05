// 화면 위쪽 게임 바(주차·AP·피로·예산·신임·다음 주로)와 알림
import { getState, unreadCount } from './game/state.js';
import { endWeek } from './game/turn.js';

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
    if (!r.ok) { toast(r.msg, true); location.hash = 'inbox'; return; }
    toast(r.msg);
    if (location.hash === '#inbox') window.dispatchEvent(new CustomEvent('game:changed'));
    else location.hash = 'inbox';
  });

  document.getElementById('who').textContent = `${s.profile.title} ${s.profile.name} 선생님`;

  const n = unreadCount();
  const count = document.getElementById('inbox-count');
  count.textContent = n;
  count.hidden = n === 0;
}
