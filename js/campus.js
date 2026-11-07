// 캠퍼스 지도: 일러스트를 화면 가득 보여 주고, 건물을 누르면 그 건물의 1층 평면도로 간다.
import { loadJSON } from './data.js';
import { getState } from './game/state.js';
import { buildingOwners } from './game/school.js';
import { FACTIONS, FACTION_KEYS } from './content/factions.js';

const SVG = 'http://www.w3.org/2000/svg';
let showOwners = true;

export async function renderCampus(app) {
  const campus = await loadJSON('data/campus.json');
  const { w, h } = campus.size;
  const s = getState();
  // 건물마다 타일 주인 분포 (반·특별실·야외 구역·호실)
  const owners = Object.fromEntries(campus.buildings.map((b) => {
    const cnt = buildingOwners(s, b.id);
    const total = Object.values(cnt).reduce((a, x) => a + x, 0);
    const top = Object.entries(cnt).sort((a, b2) => b2[1] - a[1])[0]?.[0] ?? null;
    return [b.id, { cnt, total, top }];
  }));
  const breakdown = (o) => Object.entries(o.cnt).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${FACTIONS[k].short} ${n}`).join(' · ');

  app.innerHTML = `
    <div class="map-tools">
      <button type="button" class="chip" id="owners" aria-pressed="${showOwners}">세력 색 보기</button>
      <div class="legend" ${showOwners ? '' : 'hidden'}>${FACTION_KEYS.map((k) => `<span><i class="f-${k}" style="background:var(--f)"></i>${FACTIONS[k].short}</span>`).join('')}
        <span class="note">건물 안 타일(반·특별실·호실)을 가장 많이 가진 세력의 색입니다. 자세한 판도는 <a href="#school">교내 판도</a>에서.</span></div>
    </div>
    <section class="map map-full ${showOwners ? 'show-owners' : ''}" aria-label="한일고 캠퍼스 지도">
      <svg viewBox="0 0 ${w} ${h}" role="group" aria-label="건물을 누르면 평면도로 이동합니다">
        <image href="${campus.image}" width="${w}" height="${h}"></image>
        <g id="areas"></g>
      </svg>
      <div class="map-tip" id="tip" hidden></div>
    </section>`;

  const areas = app.querySelector('#areas');
  const tip = app.querySelector('#tip');
  const go = (b) => { location.hash = `b-${b.id}`; };

  for (const b of campus.buildings) {
    const poly = document.createElementNS(SVG, 'polygon');
    poly.setAttribute('points', b.area.map((p) => p.join(',')).join(' '));
    const o = owners[b.id];
    poly.setAttribute('class', `area${o.top ? ` o-${o.top}` : ''}`);
    poly.setAttribute('tabindex', '0');
    poly.setAttribute('role', 'link');
    poly.setAttribute('aria-label', o.total ? `${b.name}: ${breakdown(o)}` : b.name);
    poly.dataset.id = b.id;
    poly.addEventListener('click', () => go(b));
    poly.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(b); } });
    poly.addEventListener('pointerenter', () => showTip(b, poly));
    poly.addEventListener('pointerleave', () => { tip.hidden = true; });
    poly.addEventListener('focus', () => showTip(b, poly));
    poly.addEventListener('blur', () => { tip.hidden = true; });
    areas.appendChild(poly);
  }

  function showTip(b, poly) {
    const box = poly.getBBox();
    const scale = poly.ownerSVGElement.getBoundingClientRect().width / w;
    const o = owners[b.id];
    tip.innerHTML = `<b>${b.name}</b>${o.total ? ` <span>${breakdown(o)}</span>` : ''}${b.floorplan ? '' : ' <span>평면도 준비 중</span>'}`;
    tip.style.left = `${(box.x + box.width / 2) * scale}px`;
    tip.style.top = `${box.y * scale}px`;
    tip.hidden = false;
  }

  app.querySelector('#owners').addEventListener('click', () => { showOwners = !showOwners; window.dispatchEvent(new CustomEvent('game:changed')); });

  return [{ label: '캠퍼스' }];
}
