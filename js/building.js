// 건물 화면: 층별 평면도를 타일로 그린다. 처음에는 1층을 보여 준다.
import { loadJSON, FLOOR_LABEL, KIND_LABEL } from './data.js';
import { getState } from './game/state.js';
import { esc } from './ui.js';

const SVG = 'http://www.w3.org/2000/svg';
// 받침에 따라 '로'/'으로'를 붙인다 (받침 없음이나 ㄹ 받침이면 '로').
function withRo(word) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const jong = code >= 0 && code < 11172 ? code % 28 : 0;
  return word + (jong === 0 || jong === 8 ? '로' : '으로');
}

const LEGEND = ['dorm_room', 'corridor', 'stair', 'entrance', 'warden', 'lounge', 'facility', 'hidden'];

export async function renderBuilding(app, id) {
  const campus = await loadJSON('data/campus.json');
  const b = campus.buildings.find((x) => x.id === id);
  if (!b) {
    app.innerHTML = `<div class="panel empty"><h1>찾을 수 없는 건물입니다</h1><a class="btn primary" href="#campus">캠퍼스로 돌아가기</a></div>`;
    return [{ label: '캠퍼스', href: '#campus' }, { label: '알 수 없음' }];
  }
  const crumbs = [{ label: '캠퍼스', href: '#campus' }, { label: b.name }];

  if (!b.floorplan) {
    app.innerHTML = `
      <div class="panel empty">
        <span class="badge">${b.no}번 · ${b.kind}</span>
        <h1>${b.name}</h1>
        <p class="muted">${b.role}</p>
        <p class="note">이 건물의 평면도는 아직 준비 중입니다.</p>
        <a class="btn primary" href="#campus">캠퍼스로 돌아가기</a>
      </div>`;
    return crumbs;
  }

  const plan = await loadJSON(b.floorplan);
  // 담임반 학생은 현제관 C동 호실에 산다 (호실 id가 평면도 타일 id와 같다).
  const residents = (tileId) => (b.id === 'hyeonje-c' ? getState().students.filter((s) => s.room === tileId) : []);
  const floors = Object.keys(plan.floors);
  let floor = floors.includes('1F') ? '1F' : floors[0];
  let selected = null;
  const tileIndex = new Map();
  for (const f of floors) for (const t of plan.floors[f]) tileIndex.set(t.id, { ...t, floor: f });

  app.innerHTML = `
    <div class="bhead">
      <div><span class="badge">${b.no}번 · ${b.kind}</span><h1>${plan.building}</h1></div>
      <div class="floors" role="group" aria-label="층 선택">${floors.map((f) =>
        `<button type="button" data-floor="${f}">${FLOOR_LABEL[f] || f}</button>`).join('')}</div>
    </div>
    <div class="layout">
      <section class="plan" aria-label="평면도"><svg id="plan" viewBox="0 0 ${plan.canvas.w} ${plan.canvas.h}"></svg></section>
      <aside class="panel" id="detail"></aside>
    </div>
    <div class="legend">${LEGEND.map((k) => `<span><i class="sw-${k}"></i>${KIND_LABEL[k]}</span>`).join('')}</div>`;

  // 범례 색은 평면도 타일과 같은 토큰을 쓴다.
  for (const k of LEGEND) {
    const i = app.querySelector(`.sw-${k}`);
    i.style.background = `var(--t-${{ dorm_room: 'room', corridor: 'pass', stair: 'stair', entrance: 'entrance', warden: 'warden', lounge: 'lounge', facility: 'facility', hidden: 'hidden' }[k]})`;
  }

  const svg = app.querySelector('#plan');
  const detail = app.querySelector('#detail');
  app.querySelectorAll('.floors button').forEach((btn) =>
    btn.addEventListener('click', () => { floor = btn.dataset.floor; selected = null; draw(); }));

  function draw() {
    app.querySelectorAll('.floors button').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.floor === floor)));
    svg.replaceChildren();
    for (const t of plan.floors[floor]) {
      const g = document.createElementNS(SVG, 'g');
      g.setAttribute('class', `tile k-${t.kind}${selected === t.id ? ' is-selected' : ''}`);
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', t.label);
      g.innerHTML = `<rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" rx="4"></rect>
        <text x="${t.x + t.w / 2}" y="${t.y + t.h / 2 + 2}" text-anchor="middle">${t.label}</text>
        ${t.kind === 'dorm_room' || t.kind === 'lounge' ? `<text class="sub" x="${t.x + t.w / 2}" y="${t.y + t.h / 2 + 20}" text-anchor="middle">${residents(t.id).length ? `담임반 ${residents(t.id).length}명` : '무소속'}</text>` : ''}
        ${t.kind === 'stair' && t.to ? `<text class="sub" x="${t.x + t.w / 2}" y="${t.y + t.h / 2 + 20}" text-anchor="middle">${floors.indexOf(t.to) > floors.indexOf(floor) ? '▲' : '▼'} 눌러서 이동</text>` : ''}`;
      if (t.kind === 'stair' && t.to) g.setAttribute('aria-label', `${t.label}: ${withRo(FLOOR_LABEL[t.to] || t.to)} 이동`);
      // 계단을 누르면 연결된 층으로 올라가거나 내려가고, 도착한 층의 계단을 선택해 둔다.
      const pick = () => {
        if (t.kind === 'stair' && t.to && plan.floors[t.to]) {
          const arrival = plan.floors[t.to].find((s) => s.kind === 'stair' && s.to === floor);
          floor = t.to;
          selected = arrival ? arrival.id : null;
        } else {
          selected = t.id;
        }
        draw();
      };
      g.addEventListener('click', pick);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      svg.appendChild(g);
    }
    showDetail();
  }

  function showDetail() {
    if (!selected) {
      const tiles = plan.floors[floor];
      const rooms = tiles.filter((t) => t.kind === 'dorm_room').length;
      detail.innerHTML = `<h2>${FLOOR_LABEL[floor] || floor}</h2>
        <p class="note">타일을 누르면 정보가 나옵니다. 계단을 누르면 연결된 층으로 이동합니다.</p>
        <dl class="kv"><dt>타일</dt><dd>${tiles.length}개</dd><dt>호실</dt><dd>${rooms}개</dd></dl>`;
      return;
    }
    const t = tileIndex.get(selected);
    const flags = [
      t.deviance_site && '일탈이 일어나는 곳',
      t.fight_site && '싸움 장소 (패도)',
      t.ghost_site && '괴담 장소',
    ].filter(Boolean);
    const links = t.adjacent.map((aid) => tileIndex.get(aid)).filter(Boolean);
    detail.innerHTML = `
      <h2>${t.label}</h2>
      <dl class="kv">
        <dt>종류</dt><dd>${plan.kinds[t.kind] || KIND_LABEL[t.kind]}</dd>
        <dt>위치</dt><dd>${FLOOR_LABEL[t.floor] || t.floor}</dd>
        ${t.kind === 'dorm_room' || t.kind === 'lounge' ? `<dt>지배</dt><dd>${residents(t.id).length ? '우리 계파 (담임반)' : '무소속'}</dd>` : ''}
        ${flags.length ? `<dt>특징</dt><dd>${flags.join(', ')}</dd>` : ''}
        ${t.note ? `<dt>메모</dt><dd>${t.note}</dd>` : ''}
      </dl>
      ${residents(t.id).length ? `<h2>사는 학생</h2><div class="chips">${residents(t.id).map((s) => `<a class="chip" href="#s-${s.id}">${esc(s.name)}</a>`).join('')}</div>` : ''}
      <h2>이어진 곳</h2>
      <div class="chips">${links.map((l) =>
        `<button type="button" class="chip" data-go="${l.id}">${l.floor !== t.floor ? (FLOOR_LABEL[l.floor] || l.floor) + ' ' : ''}${l.label}</button>`).join('') || '<span class="note">없음</span>'}</div>`;
    detail.querySelectorAll('[data-go]').forEach((c) => c.addEventListener('click', () => {
      const target = tileIndex.get(c.dataset.go);
      floor = target.floor; selected = target.id; draw();
    }));
  }

  draw();
  return crumbs;
}
