// 화면 전환
// 게임 밖: #title 대기 화면 · #new 새로 플레이 · #saves 세이브 파일 · #settings 설정
// 게임 안: #campus 캠퍼스 · #b-<건물> 평면도 · #class 담임반 · #s-<학생> 학생 · #school 교내 판도 · #duel-<반> 대결 · #office 교무실
//          #inbox 받은 편지함 · #plan 행동·훈련 · #profile 프로필
import { renderCampus } from './campus.js';
import { renderBuilding } from './building.js';
import { renderHomeroom } from './homeroom.js';
import { renderStudent } from './student.js';
import { renderInbox } from './inbox.js';
import { renderPlan } from './plan.js';
import { renderProfile } from './profile.js';
import { renderSchool } from './school-view.js';
import { renderDuel } from './duel-view.js';
import { renderOffice } from './office-view.js';
import { renderLoading, renderTitle, renderNewGame, renderSaves, renderSettings, resetDraft } from './menu.js';
import { renderGamebar, toast } from './chrome.js';
import { isPlaying, quitToTitle, migrateOldSave } from './game/state.js';
import { applySettings } from './settings.js';

const app = document.getElementById('app');
const crumbsEl = document.getElementById('crumbs');
const MENU = { title: renderTitle, new: renderNewGame, saves: renderSaves, settings: renderSettings };

async function route({ keepScroll = false } = {}) {
  const hash = location.hash.slice(1) || 'title';
  try {
    // 게임 밖 화면
    if (MENU[hash] || !isPlaying()) {
      const name = MENU[hash] ? hash : 'title';
      if (name === 'title' && isPlaying()) { quitToTitle(); toast('저장했습니다.'); }
      if (name !== 'new') resetDraft();
      if (location.hash.slice(1) !== name) { history.replaceState(null, '', `#${name}`); }
      document.body.dataset.mode = 'menu';
      crumbsEl.hidden = true;
      MENU[name](app);
      if (!keepScroll) window.scrollTo(0, 0);
      return;
    }

    // 게임 안 화면
    document.body.dataset.mode = 'game';
    let crumbs;
    if (hash.startsWith('b-')) crumbs = await renderBuilding(app, hash.slice(2));
    else if (hash === 'class') crumbs = renderHomeroom(app);
    else if (hash.startsWith('s-')) crumbs = renderStudent(app, hash.slice(2));
    else if (hash === 'school') crumbs = renderSchool(app);
    else if (hash.startsWith('duel-')) crumbs = renderDuel(app, hash.slice(5));
    else if (hash === 'office') crumbs = renderOffice(app);
    else if (hash === 'inbox') crumbs = renderInbox(app);
    else if (hash === 'plan') crumbs = renderPlan(app);
    else if (hash === 'profile') crumbs = renderProfile(app);
    else crumbs = await renderCampus(app);
    // 단계가 하나뿐이면 위 메뉴와 같은 말이 되므로 표시하지 않는다.
    crumbsEl.innerHTML = crumbs.length < 2 ? '' : crumbs.map((c, i) =>
      (i ? '<span aria-hidden="true">›</span>' : '') +
      (c.href ? `<a href="${c.href}">${c.label}</a>` : `<span aria-current="page">${c.label}</span>`)).join('');
    crumbsEl.hidden = crumbs.length < 2;
    const section = hash === 'class' || hash.startsWith('s-') ? 'class' : hash === 'school' || hash.startsWith('duel-') ? 'school' : ['inbox', 'plan', 'profile', 'office'].includes(hash) ? hash : 'campus';
    document.querySelectorAll('.mainnav a').forEach((a) => a.setAttribute('aria-current', String(a.dataset.section === section)));
    renderGamebar();
    if (!keepScroll) window.scrollTo(0, 0);
  } catch (err) {
    app.innerHTML = `<div class="panel empty"><h1>화면을 불러오지 못했습니다</h1><p class="muted">${err.message}</p>
      <p class="note">파일을 직접 열었다면 로컬 서버로 실행해 주세요 (README 참고).</p></div>`;
  }
}

// 처음 열면 로딩 후 항상 대기 화면부터 보여 준다.
async function boot() {
  applySettings();
  migrateOldSave();
  document.body.dataset.mode = 'menu';
  await renderLoading(app);
  history.replaceState(null, '', '#title');
  window.addEventListener('hashchange', () => route());
  window.addEventListener('game:changed', () => route({ keepScroll: true }));
  route();
}

boot();
