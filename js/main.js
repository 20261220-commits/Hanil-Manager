// 화면 전환: #campus = 캠퍼스 지도, #b-<건물 id> = 그 건물의 평면도
import { renderCampus } from './campus.js';
import { renderBuilding } from './building.js';

const app = document.getElementById('app');
const crumbsEl = document.getElementById('crumbs');

async function route() {
  const hash = location.hash.slice(1);
  try {
    const crumbs = hash.startsWith('b-')
      ? await renderBuilding(app, hash.slice(2))
      : await renderCampus(app);
    crumbsEl.innerHTML = crumbs.map((c, i) =>
      (i ? '<span aria-hidden="true">›</span>' : '') +
      (c.href ? `<a href="${c.href}">${c.label}</a>` : `<span aria-current="page">${c.label}</span>`)).join('');
    window.scrollTo(0, 0);
  } catch (err) {
    app.innerHTML = `<div class="panel empty"><h1>화면을 불러오지 못했습니다</h1><p class="muted">${err.message}</p>
      <p class="note">파일을 직접 열었다면 로컬 서버로 실행해 주세요 (README 참고).</p></div>`;
  }
}

window.addEventListener('hashchange', route);
route();
