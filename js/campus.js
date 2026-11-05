// 캠퍼스 지도: 일러스트를 화면 가득 보여 주고, 건물을 누르면 그 건물의 1층 평면도로 간다.
import { loadJSON } from './data.js';

const SVG = 'http://www.w3.org/2000/svg';

export async function renderCampus(app) {
  const campus = await loadJSON('data/campus.json');
  const { w, h } = campus.size;

  app.innerHTML = `
    <section class="map map-full" aria-label="한일고 캠퍼스 지도">
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
    poly.setAttribute('class', 'area');
    poly.setAttribute('tabindex', '0');
    poly.setAttribute('role', 'link');
    poly.setAttribute('aria-label', b.name);
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
    tip.innerHTML = `<b>${b.name}</b>${b.floorplan ? '' : ' <span>평면도 준비 중</span>'}`;
    tip.style.left = `${(box.x + box.width / 2) * scale}px`;
    tip.style.top = `${box.y * scale}px`;
    tip.hidden = false;
  }

  return [{ label: '캠퍼스' }];
}
