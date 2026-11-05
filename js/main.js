// 화면 전환
// #campus 캠퍼스 지도 · #b-<건물 id> 평면도 · #class 담임반 · #s-<학생 id> 학생 상세 · #inbox 받은 편지함 · #plan 행동·훈련
import { renderCampus } from './campus.js';
import { renderBuilding } from './building.js';
import { renderHomeroom } from './homeroom.js';
import { renderStudent } from './student.js';
import { renderInbox } from './inbox.js';
import { renderPlan } from './plan.js';
import { renderGamebar } from './chrome.js';

const app = document.getElementById('app');
const crumbsEl = document.getElementById('crumbs');

async function route({ keepScroll = false } = {}) {
  const hash = location.hash.slice(1);
  try {
    let crumbs;
    if (hash.startsWith('b-')) crumbs = await renderBuilding(app, hash.slice(2));
    else if (hash === 'class') crumbs = renderHomeroom(app);
    else if (hash.startsWith('s-')) crumbs = renderStudent(app, hash.slice(2));
    else if (hash === 'inbox') crumbs = renderInbox(app);
    else if (hash === 'plan') crumbs = renderPlan(app);
    else crumbs = await renderCampus(app);
    // 단계가 하나뿐이면 위 메뉴와 같은 말이 되므로 표시하지 않는다.
    crumbsEl.innerHTML = crumbs.length < 2 ? '' : crumbs.map((c, i) =>
      (i ? '<span aria-hidden="true">›</span>' : '') +
      (c.href ? `<a href="${c.href}">${c.label}</a>` : `<span aria-current="page">${c.label}</span>`)).join('');
    crumbsEl.hidden = crumbs.length < 2;
    const section = hash === 'class' || hash.startsWith('s-') ? 'class' : hash === 'inbox' ? 'inbox' : hash === 'plan' ? 'plan' : 'campus';
    document.querySelectorAll('.mainnav a').forEach((a) => a.setAttribute('aria-current', String(a.dataset.section === section)));
    renderGamebar();
    if (!keepScroll) window.scrollTo(0, 0);
  } catch (err) {
    app.innerHTML = `<div class="panel empty"><h1>화면을 불러오지 못했습니다</h1><p class="muted">${err.message}</p>
      <p class="note">파일을 직접 열었다면 로컬 서버로 실행해 주세요 (README 참고).</p></div>`;
  }
}

window.addEventListener('hashchange', () => route());
window.addEventListener('game:changed', () => route({ keepScroll: true }));
route();
