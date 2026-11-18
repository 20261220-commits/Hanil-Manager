// 2막 전국 지도: 헥스 맵, 권역 현황, 학교 목록과 정복전 선언 (룰북 11.0, 11.5)
import { getState } from './game/state.js';
import { nationMap, ensureNation, regionStatus, openRegions, declareBlock, declareWar, awayDistance, schoolById, DECLARE_AP,
  REGIONS, SCHOOLS, TIERS, LINES } from './game/nation.js';
import { challengeBlock, target, DUEL_AP } from './game/duel.js';
import { notify } from './chrome.js';
import { esc } from './ui.js';

let selRegion = 'chung';
let selCell = null;
const R = 10, W = Math.sqrt(3) * R, RH = 1.5 * R; // 뾰족한 위쪽 헥스

const hexPts = (x, y) => Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 180) * (60 * i - 30);
  return `${(x + R * Math.cos(a)).toFixed(1)},${(y + R * Math.sin(a)).toFixed(1)}`;
}).join(' ');
const posOf = (c) => ({ x: c.col * W + (c.row % 2 ? W / 2 : 0) + W, y: c.row * RH + R + 2 });

function mapSvg(s, open) {
  const { cells } = nationMap();
  const maxX = Math.max(...cells.map((c) => posOf(c).x)) + W;
  const maxY = Math.max(...cells.map((c) => posOf(c).y)) + R + 2;
  const parts = [], marks = [];
  for (const c of cells) {
    const { x, y } = posOf(c);
    const owned = c.schools.filter((id) => s.nation.schools[id].owner === 'player').length;
    const cls = ['hx', `r-${c.region}`];
    if (!open.has(c.region)) cls.push('closed');
    if (c.schools.length) cls.push('has');
    if (selCell === c.key) cls.push('sel');
    if (c.home || (c.schools.length && owned === c.schools.length)) cls.push('mine');
    const label = c.home ? '한일고 (본교)' : c.schools.length ? c.schools.map((id) => schoolById(id).name).join(', ') : REGIONS[c.region].name;
    parts.push(`<polygon class="${cls.join(' ')}" points="${hexPts(x, y)}" data-cell="${c.key}"><title>${esc(label)}</title></polygon>`);
    if (c.home) marks.push(`<text class="hx-home" x="${x}" y="${y + 3.5}">본교</text>`);
    else if (c.schools.length) {
      const boss = c.schools.some((id) => schoolById(id).tier === 'boss');
      const war = c.schools.some((id) => s.nation.declared[id]);
      const st = owned === c.schools.length ? 'own' : war ? 'war' : 'ai';
      marks.push(`<circle class="hx-dot ${st}${boss ? ' boss' : ''}" cx="${x}" cy="${y}" r="${boss ? 5 : 3.3}"/>`);
      if (c.schools.length > 1) marks.push(`<text class="hx-n" x="${x + 5.5}" y="${y - 4}">${c.schools.length}</text>`);
    }
  }
  // 권역 이름: 학교 칸 평균 위치
  const labels = Object.keys(REGIONS).map((r) => {
    const cs = cells.filter((c) => c.region === r && c.schools.length);
    const p = cs.map(posOf);
    const x = p.reduce((a, q) => a + q.x, 0) / p.length, y = p.reduce((a, q) => a + q.y, 0) / p.length;
    const at = { capital: [-52, 4], gangwon: [34, -14], chung: [48, 20], honam: [-30, 26], yeong: [18, 42], jeju: [0, 22] }[r];
    return `<text class="hx-region" x="${(x + at[0]).toFixed(0)}" y="${(y + at[1]).toFixed(0)}">${REGIONS[r].name}</text>`;
  });
  return `<svg class="nation-map" viewBox="0 0 ${maxX.toFixed(0)} ${maxY.toFixed(0)}" role="img" aria-label="전국 헥스 지도">${parts.join('')}${marks.join('')}${labels.join('')}</svg>`;
}

function schoolRow(s, id, open) {
  const sc = schoolById(id), st = s.nation.schools[id], max = TIERS[sc.tier].pride;
  const away = awayDistance(sc);
  let act;
  if (st.owner === 'player') act = '<span class="pill good">분교</span>';
  else if (s.nation.declared[id]) {
    const block = challengeBlock(s, target(s, id));
    act = block ? `<span class="note">${esc(block)}</span>` : `<a class="btn small primary" href="#duel-${id}">정복전 대결 (${DUEL_AP} AP)</a>`;
  } else {
    const block = declareBlock(s, id);
    act = block ? `<span class="note">${esc(open.has(sc.region) ? block : '권역이 닫혀 있음')}</span>` : `<button type="button" class="btn small" data-declare="${id}">선전포고 (${DECLARE_AP} AP)</button>`;
  }
  return `<tr class="${selCell && nationMap().byKey.get(selCell)?.schools.includes(id) ? 'hl' : ''}">
    <td><b>${esc(sc.name)}</b>${sc.tier === 'boss' ? ' <span class="pill warn">전국 명문</span>' : sc.tier === 'regional' ? ' <span class="pill">지역 명문</span>' : ''}<br><span class="note">${esc(sc.city)} · ${LINES[sc.line].name}${sc.girls ? ' · 여고' : ''}</span></td>
    <td>${st.owner === 'player' ? '<span class="note">-</span>' : `<span class="meter"><i style="width:${(st.pride / max) * 100}%"></i></span> <span class="note">${st.pride}/${max}</span>`}</td>
    <td class="note">${away}칸${away >= 4 ? ` · 컨디션 -${5 * Math.floor(away / 4)}%` : ''}</td>
    <td>${act}</td></tr>`;
}

export function renderNation(app) {
  const s = getState();
  if (!ensureNation(s)) { app.innerHTML = '<div class="panel empty"><h1>아직 1막입니다</h1><p class="muted">캠퍼스를 모두 점령해 교장으로 추대되면 2막(전국 정복)이 열립니다.</p><a class="btn" href="#school">교내 판도로</a></div>'; return [{ label: '전국' }]; }
  const open = openRegions(s);
  const branches = SCHOOLS.filter((x) => s.nation.schools[x.id].owner === 'player').length;
  const stat = Object.fromEntries(Object.keys(REGIONS).map((r) => [r, regionStatus(s, r)]));
  const ctrl = Object.values(stat).filter((x) => x.controlled).length;
  const wars = Object.keys(s.nation.declared).filter((id) => s.nation.schools[id].owner !== 'player');

  const regionCards = Object.keys(REGIONS).map((r) => {
    const x = stat[r];
    const tag = x.controlled ? '<span class="pill good">장악</span>' : open.has(r) ? '<span class="pill">진출 가능</span>' : '<span class="pill muted">닫힘</span>';
    return `<button type="button" class="region-card r-${r}${selRegion === r ? ' on' : ''}" data-region="${r}" aria-pressed="${selRegion === r}">
      <span class="row between"><b>${REGIONS[r].name}</b>${tag}</span>
      <span class="note">분교 ${x.owned}/${x.total} (과반 ${Math.floor(x.total / 2) + 1}) · 전국 명문 ${x.bossOwned}/${x.bosses}</span></button>`;
  }).join('');

  const cellSchools = selCell ? nationMap().byKey.get(selCell)?.schools ?? [] : [];
  const list = SCHOOLS.filter((x) => x.region === selRegion)
    .sort((a, b) => (cellSchools.includes(b.id) - cellSchools.includes(a.id)) || ['boss', 'regional', 'normal'].indexOf(a.tier) - ['boss', 'regional', 'normal'].indexOf(b.tier) || awayDistance(a) - awayDistance(b));

  app.innerHTML = `
    <div class="bhead"><div><span class="badge">2막 · ${esc(s.weekLabel)}</span><h1>전국 정복</h1></div>
      <div class="note">분교 ${branches}/${SCHOOLS.length} · 권역 장악 ${ctrl}/6 · 분교 상납 주 ${branches}만원</div></div>
    ${s.nation.won ? '<section class="panel result good"><h2>전국 정복 완료</h2><p class="note">6개 권역을 모두 장악했습니다. 남은 학교도 계속 정복할 수 있습니다.</p></section>' : ''}
    <div class="nation-grid">
      <section class="panel map-panel"><h2>전국 지도 <span class="note">칸을 누르면 그 학교를 봅니다</span></h2>
        ${mapSvg(s, open)}
        <p class="legend note"><span class="lg own"></span>분교 <span class="lg war"></span>정복전 중 <span class="lg ai"></span>상대 학교 <span class="lg boss"></span>큰 점: 전국 명문 · 흐린 권역은 아직 닿지 않습니다</p>
      </section>
      <div class="side-stack">
        <section class="panel"><h2>권역</h2><div class="region-list">${regionCards}</div>
          <p class="note">권역은 그 권역 학교의 과반과 전국 명문을 모두 분교로 만들면 장악합니다. 장악한 권역의 이웃 권역에 진출할 수 있습니다.</p></section>
        <section class="panel"><h2>진행 중인 정복전</h2>${wars.length ? `<ul class="plain">${wars.map((id) => { const sc = schoolById(id); return `<li><a href="#duel-${id}">${esc(sc.name)}</a> <span class="note">자존심 ${s.nation.schools[id].pride}/${TIERS[sc.tier].pride}</span></li>`; }).join('')}</ul>` : '<p class="note">아직 선전포고한 학교가 없습니다.</p>'}</section>
      </div>
    </div>
    <section class="panel"><div class="row between"><h2>${REGIONS[selRegion].name} 학교 ${list.length}곳</h2>${open.has(selRegion) ? '' : '<span class="note">인접 권역을 먼저 장악해야 진출할 수 있습니다</span>'}</div>
      <p class="note">선전포고(${DECLARE_AP} AP) 뒤 대결(${DUEL_AP} AP)로 자존심을 깎습니다. 압승 -30, 승리 -20, 신승 -10이고 0이 되면 분교가 됩니다. 자존심은 매주 회복합니다 (전국 명문 +4, 나머지 +2). 원정은 4칸마다 출전 학생 컨디션 -5%이고, 본교 지원으로 우리 팀 전력 +8%입니다. 한 곳을 분교로 만들면 같은 권역 학교들의 자존심이 10 떨어집니다 (전국 명문을 꺾으면 25).</p>
      <div class="table-wrap"><table class="roster nation"><thead><tr><th>학교</th><th>자존심</th><th>거리</th><th></th></tr></thead>
        <tbody>${list.map((x) => schoolRow(s, x.id, open)).join('')}</tbody></table></div></section>`;

  app.querySelectorAll('[data-region]').forEach((b) => b.addEventListener('click', () => { selRegion = b.dataset.region; selCell = null; renderNation(app); }));
  app.querySelectorAll('[data-cell]').forEach((p) => p.addEventListener('click', () => {
    const c = nationMap().byKey.get(p.dataset.cell);
    selRegion = c.region; selCell = c.schools.length ? c.key : null;
    renderNation(app);
    if (selCell) app.querySelector('.nation tr.hl')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }));
  app.querySelectorAll('[data-declare]').forEach((b) => b.addEventListener('click', () => notify(declareWar(b.dataset.declare))));
  return [{ label: '전국' }];
}
