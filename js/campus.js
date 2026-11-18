// 캠퍼스 지도: 일러스트를 화면 가득 보여 주고, 건물을 누르면 그 건물의 1층 평면도로 간다.
import { loadJSON } from './data.js';
import { getState } from './game/state.js';
import { buildingOwners } from './game/school.js';
import { FACTIONS } from './content/factions.js';

const SVG = 'http://www.w3.org/2000/svg';

export async function renderCampus(app) {
  const campus = await loadJSON('data/campus.json');
  const { w, h } = campus.size;
  const s = getState();
  // 건물마다 타일 주인 분포 (반·특별실·야외 구역·호실)
  const owners = Object.fromEntries(campus.buildings.map((b) => {
    const cnt = buildingOwners(s, b.id);
    const total = Object.values(cnt).reduce((a, x) => a + x, 0);
    return [b.id, { cnt, total }];
  }));
  const breakdown = (o) => Object.entries(o.cnt).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${FACTIONS[k].short} ${n}`).join(' · ');

  app.innerHTML = `
    <section class="map map-full" aria-label="캠퍼스 지도">
      <svg viewBox="0 0 ${w} ${h}" role="group" aria-label="건물을 누르면 평면도로 이동합니다">
        <image href="${campus.image}" width="${w}" height="${h}"></image>
        ${worldFx(s.world, w, h)}
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
    poly.setAttribute('class', 'area');
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

  return [{ label: '캠퍼스' }];
}

// 세계관별 지도 분위기: 그림 위에 색조·안개·별·격자를 얹는다 (건물 위치는 그대로)
function worldFx(world, w, h) {
  const rnd = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
  if (world === 'wuxia') {
    return `<g class="fx" aria-hidden="true">
      <defs><linearGradient id="fx-mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4ead6" stop-opacity=".75"/><stop offset=".35" stop-color="#f4ead6" stop-opacity="0"/>
        <stop offset=".8" stop-color="#f4ead6" stop-opacity="0"/><stop offset="1" stop-color="#e9dcc0" stop-opacity=".45"/></linearGradient></defs>
      <rect width="${w}" height="${h}" fill="#c9a46a" style="mix-blend-mode:multiply" opacity=".28"/>
      <rect width="${w}" height="${h}" fill="url(#fx-mist)"/>
      ${[0.04, 0.1, 0.16].map((y, i) => `<ellipse class="fx-cloud" cx="${w * (0.15 + i * 0.35)}" cy="${h * y}" rx="${w * 0.2}" ry="${h * 0.03}" fill="#fbf6ea" opacity=".35"/>`).join('')}
    </g>`;
  }
  if (world === 'magic') {
    const stars = Array.from({ length: 70 }, (_, i) => `<circle class="fx-star" style="animation-delay:${(rnd(i) * 4).toFixed(2)}s" cx="${(rnd(i + 1) * w).toFixed(0)}" cy="${(rnd(i + 2) * h * 0.4).toFixed(0)}" r="${(1.2 + rnd(i + 3) * 2.4).toFixed(1)}" fill="#fff6d0"/>`).join('');
    const lights = Array.from({ length: 14 }, (_, i) => `<circle cx="${(rnd(i + 40) * w).toFixed(0)}" cy="${(h * 0.35 + rnd(i + 41) * h * 0.6).toFixed(0)}" r="${(w * 0.025).toFixed(0)}" fill="url(#fx-glow)"/>`).join('');
    return `<g class="fx" aria-hidden="true">
      <defs><radialGradient id="fx-glow"><stop offset="0" stop-color="#ffd27a" stop-opacity=".9"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
        <linearGradient id="fx-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1446"/><stop offset="1" stop-color="#3a2f7a"/></linearGradient></defs>
      <rect width="${w}" height="${h}" fill="url(#fx-night)" style="mix-blend-mode:multiply" opacity=".72"/>
      ${lights}${stars}
    </g>`;
  }
  if (world === 'cyber') {
    const step = Math.round(w / 32);
    return `<g class="fx" aria-hidden="true">
      <defs><pattern id="fx-grid" width="${step}" height="${step}" patternUnits="userSpaceOnUse"><path d="M ${step} 0 L 0 0 0 ${step}" fill="none" stroke="#3cf0ff" stroke-width="1.2" opacity=".35"/></pattern>
        <linearGradient id="fx-neon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a1a3a"/><stop offset=".6" stop-color="#14204a"/><stop offset="1" stop-color="#3a0f4a"/></linearGradient></defs>
      <rect width="${w}" height="${h}" fill="url(#fx-neon)" style="mix-blend-mode:multiply" opacity=".5"/>
      <rect width="${w}" height="${h}" fill="url(#fx-grid)"/>
      <rect class="fx-scan" width="${w}" height="${(h * 0.06).toFixed(0)}" fill="#3cf0ff" opacity=".08"/>
    </g>`;
  }
  return '';
}
