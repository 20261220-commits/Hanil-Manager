// 교내 판도: 반 24개의 주인, 담임, 지지도와 대결 신청
import { getState } from './game/state.js';
import { playerClasses, semesterGoal, leader, placeInfo } from './game/school.js';
import { challengeBlock, target, DUEL_AP } from './game/duel.js';
import { threat } from './game/ai.js';
import { PLACE_KIND, HOW_TO_TAKE } from './content/places.js';
import { FACTIONS, FACTION_KEYS, HOMEROOM_ID, classLabel } from './content/factions.js';
import { esc } from './ui.js';

export const factionChip = (k, text) => `<span class="fchip f-${k}"><i aria-hidden="true"></i>${esc(text ?? FACTIONS[k].name)}</span>`;

export function supportBar(sup) {
  const parts = FACTION_KEYS.filter((k) => sup[k] >= 0.5).sort((a, b) => (a === 'player' ? -1 : b === 'player' ? 1 : sup[b] - sup[a]));
  const label = parts.map((k) => `${FACTIONS[k].short} ${Math.round(sup[k])}%`).join(', ');
  return `<span class="supbar" role="img" aria-label="지지도: ${label}" title="${label}">${parts.map((k) => `<i class="f-${k}" style="width:${sup[k]}%"></i>`).join('')}</span>`;
}

export function renderSchool(app) {
  const s = getState();
  const sc = s.school;
  const goal = semesterGoal(s);
  const owned = playerClasses(s).length;
  const counts = Object.fromEntries(FACTION_KEYS.map((k) => [k, sc.classes.filter((c) => c.owner === k).length]));
  const placeCounts = Object.fromEntries(FACTION_KEYS.map((k) => [k, sc.places.filter((p) => p.owner === k && placeInfo(p.id).kind !== 'base').length]));
  const th = threat(s);

  const placeRow = (p) => {
    const info = placeInfo(p.id);
    const t = target(s, p.id);
    const block = info.kind === 'outdoor' ? challengeBlock(s, t) : null;
    return `<tr><td><b>${esc(info.name)}</b><br><span class="note">${PLACE_KIND[info.kind]}</span></td>
      <td>${p.owner === 'neutral' ? '<span class="note">중립 (교장)</span>' : factionChip(p.owner)}</td>
      <td class="note">${esc(info.bonus)}</td>
      <td>${info.kind === 'outdoor' && p.owner !== 'player'
        ? (block ? `<span class="note">${esc(block)}</span>` : `<a class="btn small primary" href="#duel-${p.id}">대결 신청 (${DUEL_AP} AP)</a>`)
        : p.owner === 'player' ? '<span class="note">우리 땅</span>' : (info.kind === 'special' || (info.kind === 'core' && p.id !== 'principal')) ? `<a class="btn small" href="#office">${HOW_TO_TAKE[info.kind]}</a>` : `<span class="note">${p.id === 'principal' ? '다른 타일을 모두 점령하면' : HOW_TO_TAKE[info.kind]}</span>`}</td></tr>`;
  };

  const card = (c) => {
    const top = leader(c);
    const block = challengeBlock(s, target(s, c.id));
    const tags = [
      c.id === HOMEROOM_ID ? '<span class="pill good">담임반</span>' : '',
      sc.teaching.includes(c.id) ? '<span class="pill">담당 수업 +1%p/주</span>' : '',
      c.captain === 'player' ? '<span class="pill good">반장</span>' : '',
      c.owner === 'player' && c.lowTurns ? `<span class="pill bad">지배권 위험 ${c.lowTurns}/4</span>` : '',
      c.record.w + c.record.l + c.record.d ? `<span class="pill">전적 ${c.record.w}승 ${c.record.l}패${c.record.d ? ` ${c.record.d}무` : ''}</span>` : '',
    ].join('');
    const delta = c.lastDelta ? `<span class="${c.lastDelta > 0 ? 'up' : 'down'}">${c.lastDelta > 0 ? '▲' : '▼'} ${Math.abs(c.lastDelta).toFixed(1)}</span>` : '';
    return `<article class="cls o-${c.owner}">
      <header><h3>${classLabel(c.id)}</h3>${factionChip(c.owner)}</header>
      <p class="note">담임 ${esc(c.teacher.name)} 선생님${c.teacher.faction !== c.owner ? ` (${FACTIONS[c.teacher.faction].short})` : ''}</p>
      ${supportBar(c.support)}
      <p class="sup-line"><span>우리 <b>${Math.round(c.support.player)}%</b> ${delta}</span><span class="note">1위 ${FACTIONS[top].short} ${Math.round(c.support[top])}%</span></p>
      ${tags ? `<div class="chips">${tags}</div>` : ''}
      ${c.id === HOMEROOM_ID ? '<a class="btn small" href="#class">담임반 보기</a>'
        : c.owner === 'player' ? '<span class="note">우리가 점령한 반입니다. 지지도를 50% 이상으로 지켜 주세요.</span>'
          : block ? `<span class="note">${esc(block)}</span>` : `<a class="btn small primary" href="#duel-${c.id}">대결 신청 (${DUEL_AP} AP)</a>`}
    </article>`;
  };

  app.innerHTML = `
    <div class="bhead"><div><span class="badge">${esc(s.weekLabel)}</span><h1>교내 판도</h1></div>
      <p class="note">반마다 세력별 지지도가 있고 합계는 100%입니다. 지지도 50% 이상인 반에서 대결에 이기면 그 반을 점령합니다.</p></div>

    <div class="tiles">
      <div class="tile-stat"><span class="lbl">점령한 반</span><b>${owned} / ${sc.classes.length}</b></div>
      <div class="tile-stat"><span class="lbl">담임반 지지도 (목표 70%)</span><b class="${goal.home >= 70 ? 'ok' : ''}">${Math.round(goal.home)}%</b></div>
      <div class="tile-stat"><span class="lbl">첫 학기 목표</span><b>${goal.ok ? '달성' : `${goal.home >= 70 ? '✓' : '✗'} 지지도 · ${goal.owned >= 1 ? '✓' : '✗'} 반 1개 점령`}</b></div>
      <div class="tile-stat"><span class="lbl">이번 주 날씨</span><b>${sc.weather === '비' ? '비 (야외 종목 → 농구)' : '맑음'}</b></div>
      <div class="tile-stat"><span class="lbl">AI 계파의 경계 (우리 점령 ${Math.round(th.ratio * 100)}%)</span><b class="${th.tier ? 'warn-text' : ''}">${th.label}</b></div>
    </div>

    ${sc.ai.news?.length ? `<section class="panel"><h2>지난주 교내 소식 <span class="note">AI 계파들끼리도 매주 대결·포섭·공작을 합니다</span></h2>
      <ul class="news">${sc.ai.news.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></section>` : ''}

    <div class="legend">${FACTION_KEYS.map((k) => `<span>${factionChip(k)} <span class="note">${sc.ai.gone?.[k] ? '소멸' : `반 ${counts[k]} · 장소 ${placeCounts[k]}`}</span></span>`).join('')}</div>

    ${[1, 2, 3].map((g) => `
      <h2 class="group-title">${g}학년 ${g === 1 ? '<span class="note">신입생이라 무소속이 많아 도전하기 좋습니다</span>' : g === 2 ? '<span class="note">공개 스탯 +2</span>' : '<span class="note">공개 스탯 +4</span>'}</h2>
      <div class="cls-grid">${sc.classes.filter((c) => c.grade === g).map(card).join('')}</div>`).join('')}

    <h2 class="group-title">반 밖의 땅 <span class="note">야외 구역은 대결 한 번으로 점령합니다. 운동장을 가지면 축구·야구, 무성관을 가지면 농구에서 우리가 홈입니다</span></h2>
    <div class="table-wrap"><table class="roster places"><thead><tr><th>장소</th><th>주인</th><th>효과</th><th></th></tr></thead>
      <tbody>${sc.places.map(placeRow).join('')}</tbody></table></div>

    <p class="note">지지도는 매주 담임반 학생들의 일상 영향력(친화력·사기), 담당 수업(+1%p), 반장(+1%p)으로 오릅니다. 대결 결과는 압승 ±20%p, 승리 ±12%p, 신승·석패 ±5%p입니다.
      반 사이 인접 규칙은 구작관 평면도가 나오면 적용합니다. 지금 플레이어는 어느 반에나 도전할 수 있고, AI 계파는 같은 학년(같은 층) 반끼리만 대결합니다.</p>`;

  return [{ label: '교내 판도' }];
}
