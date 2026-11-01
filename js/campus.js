// 캠퍼스 지도: 일러스트 위에 건물 영역을 겹쳐 그리고, 누르면 그 건물의 1층 평면도로 간다.
import { loadJSON } from './data.js';

const SVG = 'http://www.w3.org/2000/svg';

export async function renderCampus(app) {
  const campus = await loadJSON('data/campus.json');
  const { w, h } = campus.size;

  app.innerHTML = `
    <div class="layout">
      <section class="map" aria-label="한일고 캠퍼스 지도">
        <svg viewBox="0 0 ${w} ${h}" role="group" aria-label="건물을 누르면 평면도로 이동합니다">
          <image href="${campus.image}" width="${w}" height="${h}"></image>
          <g id="areas"></g>
        </svg>
        <div class="map-tip" id="tip" hidden></div>
      </section>
      <aside class="panel">
        <h1>한일고 캠퍼스</h1>
        <p class="note">건물을 누르면 그 건물의 1층 평면도로 이동합니다. 평면도가 아직 없는 건물은 준비 중으로 표시됩니다.</p>
        <ul class="blist" id="blist"></ul>
      </aside>
    </div>`;

  const areas = app.querySelector('#areas');
  const list = app.querySelector('#blist');
  const tip = app.querySelector('#tip');
  const map = app.querySelector('.map');

  const setHot = (id, on) => {
    areas.querySelector(`[data-id="${id}"]`)?.classList.toggle('is-hot', on);
    list.querySelector(`[data-id="${id}"]`)?.classList.toggle('is-hot', on);
  };
  const go = (b) => { location.hash = `b-${b.id}`; };

  for (const b of campus.buildings) {
    const poly = document.createElementNS(SVG, 'polygon');
    poly.setAttribute('points', b.area.map((p) => p.join(',')).join(' '));
    poly.setAttribute('class', 'area');
    poly.setAttribute('tabindex', '0');
    poly.setAttribute('role', 'link');
    poly.setAttribute('aria-label', `${b.no}. ${b.name}`);
    poly.dataset.id = b.id;
    poly.addEventListener('click', () => go(b));
    poly.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(b); } });
    poly.addEventListener('pointerenter', () => { setHot(b.id, true); showTip(b, poly); });
    poly.addEventListener('pointerleave', () => { setHot(b.id, false); tip.hidden = true; });
    poly.addEventListener('focus', () => { setHot(b.id, true); showTip(b, poly); });
    poly.addEventListener('blur', () => { setHot(b.id, false); tip.hidden = true; });
    areas.appendChild(poly);

    const li = document.createElement('li');
    li.innerHTML = `<button type="button" data-id="${b.id}">
        <span class="no">${b.no}</span><span>${b.name}</span>
        <span class="badge${b.floorplan ? ' ready' : ''}">${b.floorplan ? '평면도' : b.kind}</span></button>`;
    const btn = li.querySelector('button');
    btn.addEventListener('click', () => go(b));
    btn.addEventListener('pointerenter', () => setHot(b.id, true));
    btn.addEventListener('pointerleave', () => setHot(b.id, false));
    list.appendChild(li);
  }

  function showTip(b, poly) {
    const box = poly.getBBox();
    const svg = poly.ownerSVGElement;
    const scale = svg.getBoundingClientRect().width / w;
    tip.textContent = `${b.no}. ${b.name}`;
    tip.style.left = `${(box.x + box.width / 2) * scale}px`;
    tip.style.top = `${box.y * scale}px`;
    tip.hidden = false;
    map.appendChild(tip);
  }

  return [{ label: '캠퍼스' }];
}
