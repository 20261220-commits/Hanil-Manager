// 반 편성 화면: 사전 협상(신입생 명단·중학교 탐방·친목) → 회의(기본 배정·협상 3라운드·교감 승인)
import { getState } from './game/state.js';
import { yearTurn, weekLabel } from './game/calendar.js';
import { calcCA } from './game/students.js';
import {
  ensureMeeting, inPre, isMeetingWeek, scoutFreshmen, befriend, startMeeting, proposeTrade, answerOffer, nextRound, approve,
  ourClasses, ourValue, ourEstimate, PRE_START, MEETING, ROUNDS, SCOUT_AP, FRIEND_AP,
} from './game/meeting.js';
import { STATS } from './content/stats.js';
import { FACTIONS, AI_FACTIONS, classLabel } from './content/factions.js';
import { notify } from './chrome.js';
import { esc, traitBadge } from './ui.js';
import { factionChip } from './school-view.js';

let ui = { page: 0, sort: 'rumor', pick: new Set(), ourCls: null, theirCls: null, give: new Set(), take: null };
const caOf = (c) => calcCA(Object.fromEntries(STATS.map((k, i) => [k, c.s[i]])));
const statOf = (c, k) => c.s[STATS.indexOf(k)];
const rerender = () => window.dispatchEvent(new CustomEvent('game:changed'));

export function renderMeeting(app) {
  const s = getState();
  const t = yearTurn(s.turn);
  const mt = ensureMeeting(s);
  const head = (sub) => `<div class="bhead"><div><span class="badge">${esc(s.weekLabel)}</span><h1>반 편성</h1></div><p class="note">${sub}</p></div>`;

  if (!mt) {
    app.innerHTML = `${head('학년 말 이적시장입니다.')}
      <div class="panel empty"><h2>아직 반 편성 기간이 아닙니다</h2>
      <p class="muted">사전 협상은 ${weekLabel(s.turn - t + PRE_START).split(' (')[0]}부터, 반 편성 회의는 ${weekLabel(s.turn - t + MEETING).split(' (')[0]}에 열립니다.</p></div>`;
    return [{ label: '반 편성' }];
  }

  if (mt.phase === 'done') {
    app.innerHTML = `${head('반 편성 회의가 끝났습니다.')}
      <section class="panel result good"><h2 class="result-head">새 학년 반 편성 확정</h2>
      <p>성사된 거래 ${mt.result.trades}건${mt.result.cancelled ? ` · 교감이 취소한 거래 ${mt.result.cancelled}건` : ''} · 졸업생 ${mt.result.graduates}명</p>
      <ul class="news">${mt.log.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></section>`;
    return [{ label: '반 편성' }];
  }

  if (mt.phase === 'pre') { renderPre(app, s, mt, head, t); return [{ label: '반 편성' }]; }
  renderRound(app, s, mt, head);
  return [{ label: '반 편성' }];
}

// ---------- 사전 협상 ----------

function renderPre(app, s, mt, head, t) {
  const PAGE = 30;
  const sorted = [...mt.freshmen].sort((a, b) => (ui.sort === 'rumor' ? rumorRank(a) - rumorRank(b) : a.n.localeCompare(b.n, 'ko')));
  const pages = Math.ceil(sorted.length / PAGE);
  ui.page = Math.min(ui.page, pages - 1);
  const list = sorted.slice(ui.page * PAGE, ui.page * PAGE + PAGE);
  const canAct = inPre(s);
  app.innerHTML = `${head(`사전 협상 기간 (1월 1주 ~ 2월 3주). 반 편성 회의는 ${weekLabel(s.turn - t + MEETING).split(' (')[0]}입니다. 회의에서는 다른 반 학생과 우리 반 학생을 맞바꿀 수 있습니다.`)}
    ${isMeetingWeek(s) ? `<section class="panel agenda"><h2>반 편성 회의 주간</h2><p>회의를 열면 3학년이 졸업하고, 1·2학년은 진급해 성적순 S자로 배정됩니다. 신입생도 이때 배정됩니다.</p>
      <div class="row end"><button type="button" class="btn primary big" id="start">회의 열기 ▶</button></div></section>` : ''}
    <div class="office-cols">
      <section class="panel"><h2>동료 교사 친목 <span class="note">${FRIEND_AP} AP · 계파마다 주 1회 · 관계 +5 (관계가 좋으면 회의에서 거래가 쉬워짐)</span></h2>
        <div class="rels">${AI_FACTIONS.filter((f) => !s.school.ai?.gone?.[f]).map((f) => `<div class="rel-row">${factionChip(f)}<span class="note">관계 ${s.school.rel?.[f] ?? 0}</span>
          <button type="button" class="btn small" data-friend="${f}" ${!canAct || mt.friends[f] === s.turn || s.ap < FRIEND_AP ? 'disabled' : ''}>${mt.friends[f] === s.turn ? '이번 주에 만남' : '밥 먹기'}</button></div>`).join('')}</div>
      </section>
      <section class="panel"><h2>중학교 탐방 <span class="note">${SCOUT_AP} AP · 신입생 최대 3명의 포텐과 성향을 미리 봄</span></h2>
        <p class="note">아래 명단에서 체크한 학생: ${ui.pick.size}명</p>
        <button type="button" class="btn primary" id="scout" ${!canAct || !ui.pick.size || s.ap < SCOUT_AP ? 'disabled' : ''}>탐방하기</button>
        <p class="note">신입생은 회의 때 S자로 각 반에 배정됩니다. 눈여겨본 원석이 다른 반에 가면 트레이드로 데려오세요.</p>
      </section>
    </div>
    <section class="panel">
      <div class="row between"><h2>신입생 명단 <span class="note">${mt.freshmen.length}명 · 공개 스탯 3개와 소문만 보입니다</span></h2>
        <div class="segs"><label class="seg"><input type="radio" name="fsort" value="rumor" ${ui.sort === 'rumor' ? 'checked' : ''}><span>소문 순</span></label><label class="seg"><input type="radio" name="fsort" value="name" ${ui.sort === 'name' ? 'checked' : ''}><span>이름 순</span></label></div></div>
      <div class="table-wrap"><table class="roster plain"><thead><tr><th></th><th>이름</th><th>소문</th><th>공개 스탯</th><th>탐방 결과</th></tr></thead><tbody>
        ${list.map((c) => `<tr><td>${mt.scouted[c.id] ? '' : `<input type="checkbox" data-pick="${c.id}" ${ui.pick.has(c.id) ? 'checked' : ''} ${!ui.pick.has(c.id) && ui.pick.size >= 3 ? 'disabled' : ''} aria-label="${esc(c.n)} 탐방">`}</td>
          <td><b>${esc(c.n)}</b></td><td class="note">${esc(c.rumor)}</td>
          <td class="note">${c.pub.map((k) => `${k} ${statOf(c, k)}`).join(', ')}</td>
          <td>${mt.scouted[c.id] ? `포텐 ${c.pt}단계 · ${traitBadge(c.t)} · 현재 능력 ${caOf(c)}` : ''}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="row">${Array.from({ length: pages }, (_, i) => `<button type="button" class="chip" data-page="${i}" aria-pressed="${i === ui.page}">${i + 1}</button>`).join('')}</div>
    </section>`;

  app.querySelector('#start')?.addEventListener('click', () => notify(startMeeting()));
  app.querySelectorAll('[data-friend]').forEach((b) => b.addEventListener('click', () => notify(befriend(b.dataset.friend))));
  app.querySelectorAll('[data-pick]').forEach((c) => c.addEventListener('change', () => { if (c.checked) ui.pick.add(c.dataset.pick); else ui.pick.delete(c.dataset.pick); rerender(); }));
  app.querySelector('#scout')?.addEventListener('click', () => { const r = scoutFreshmen([...ui.pick]); if (r.ok) ui.pick.clear(); notify(r); });
  app.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => { ui.page = +b.dataset.page; rerender(); }));
  app.querySelectorAll('input[name=fsort]').forEach((r) => r.addEventListener('change', () => { ui.sort = r.value; ui.page = 0; rerender(); }));
}
const RUMOR_ORDER = ['중학교 때 전국 대회를 휩쓸었다는 소문', '중학교 때 유명했대', '선생님들이 눈여겨본 학생이래', '꽤 잘했다는 이야기', '성실하다는 평', '특별한 소문은 없음'];
const rumorRank = (c) => RUMOR_ORDER.indexOf(c.rumor);

// ---------- 협상 라운드 ----------

function renderRound(app, s, mt, head) {
  const ours = ourClasses(s);
  if (!ours.some((c) => c.id === ui.ourCls)) { ui.ourCls = ours[0]?.id ?? null; ui.give.clear(); }
  const ourGrade = ours.find((c) => c.id === ui.ourCls)?.grade;
  const rivals = s.school.classes.filter((c) => c.grade === ourGrade && c.owner !== 'player');
  if (!rivals.some((c) => c.id === ui.theirCls)) { ui.theirCls = rivals[0]?.id ?? null; ui.take = null; }
  const ourList = mt.next[ui.ourCls] ?? [], theirList = mt.next[ui.theirCls] ?? [];
  const grade = ourGrade;
  const giveVal = [...ui.give].reduce((a, id) => a + ourValue(s, ourList.find((c) => c.id === id) ?? { s: STATS.map(() => 8), p: 50, t: '' }, grade), 0);
  const takeC = theirList.find((c) => c.id === ui.take);
  const takeVal = takeC ? ourValue(s, takeC, grade) : 0;

  const row = (c, kind) => {
    const est = ourEstimate(s, c);
    const ca = caOf(c);
    const sel = kind === 'give' ? ui.give.has(c.id) : ui.take === c.id;
    return `<tr class="${sel ? 'ours' : ''}"><td><input type="${kind === 'give' ? 'checkbox' : 'radio'}" name="${kind}" value="${c.id}" ${sel ? 'checked' : ''} ${kind === 'give' && !sel && ui.give.size >= 2 ? 'disabled' : ''} aria-label="${esc(c.n)}"></td>
      <td><b>${esc(c.n)}</b></td><td>${factionChip(c.f, FACTIONS[c.f].short)}</td><td class="num">${ca}</td><td class="num">~${est}</td><td class="num">${ourValue(s, c, grade)}</td><td>${traitBadge(c.t)}</td></tr>`;
  };
  const table = (list, kind) => `<div class="table-wrap tall"><table class="roster plain"><thead><tr><th></th><th>이름</th><th>계파</th><th>현재 능력</th><th>추정 포텐</th><th>가치</th><th>성향</th></tr></thead><tbody>
    ${[...list].sort((a, b) => ourValue(s, b, grade) - ourValue(s, a, grade)).map((c) => row(c, kind)).join('')}</tbody></table></div>`;

  const balance = s.school.classes.filter((c) => c.grade === ourGrade).map((c) => {
    const list = mt.next[c.id];
    return { c, n: list.length, avg: list.reduce((a, x) => a + caOf(x), 0) / list.length, ours: list.filter((x) => x.f === 'player').length };
  });
  const gradeAvg = balance.reduce((a, b) => a + b.avg * b.n, 0) / balance.reduce((a, b) => a + b.n, 0);

  app.innerHTML = `${head(`협상 ${mt.round} / ${ROUNDS}라운드 · 이번 라운드 남은 제안 ${mt.left}건. 우리 계파가 가진 반에서만 학생을 내줄 수 있고, 같은 학년 반끼리만 거래합니다.`)}
    ${mt.offers.filter((o) => !o.done).length ? `<section class="panel agenda"><h2>들어온 제안</h2>
      ${mt.offers.map((o, i) => o.done ? '' : (() => {
        const want = mt.next[o.ourCls]?.find((c) => c.id === o.want), give = mt.next[o.theirCls]?.find((c) => c.id === o.give);
        if (!want || !give) return '';
        return `<div class="lobby-row">${factionChip(o.from)} <span>우리 <b>${esc(want.n)}</b> (가치 ${ourValue(s, want, ourGrade)}) ↔ ${classLabel(o.theirCls)} <b>${esc(give.n)}</b> (가치 ${ourValue(s, give, ourGrade)})</span>
          <button type="button" class="btn small primary" data-offer="${i}" data-accept="1">받기</button><button type="button" class="btn small" data-offer="${i}" data-accept="0">거절</button></div>`;
      })()).join('')}</section>` : ''}

    ${ours.length ? `<div class="office-cols trade">
      <section class="panel"><div class="row between"><h2>내줄 학생 (1~2명)</h2>
        <select id="our-cls">${ours.map((c) => `<option value="${c.id}" ${c.id === ui.ourCls ? 'selected' : ''}>${classLabel(c.id)}</option>`).join('')}</select></div>
        ${table(ourList, 'give')}</section>
      <section class="panel"><div class="row between"><h2>데려올 학생</h2>
        <select id="their-cls">${rivals.map((c) => `<option value="${c.id}" ${c.id === ui.theirCls ? 'selected' : ''}>${classLabel(c.id)} (${FACTIONS[c.owner].short})</option>`).join('')}</select></div>
        ${table(theirList, 'take')}</section>
    </div>
    <section class="panel">
      <div class="row between"><p>우리가 보는 가치: 내주는 쪽 <b>${giveVal || '-'}</b> · 받는 쪽 <b>${takeVal || '-'}</b></p>
        <button type="button" class="btn primary" id="propose" ${!ui.give.size || !ui.take || mt.left <= 0 ? 'disabled' : ''}>거래 제안</button></div>
      <p class="note">가치 = 현재 능력 + (추정 포텐 - 현재 능력) × 학년 계수(1학년 0.5) + 성향 보정. AI는 자기 안목으로 다르게 봅니다. 자기 강점 분야 학생은 30% 비싸게 팔고, 관계가 나쁘면 비싸게, 적대면 거래하지 않습니다.</p>
    </section>` : '<div class="panel empty"><p class="muted">우리 계파가 가진 반이 없어 거래할 수 없습니다.</p></div>'}

    <section class="panel"><h2>${ourGrade ?? 1}학년 반 균형 <span class="note">교감 승인 조건: 반마다 28~32명, 반 평균 능력이 학년 평균(${gradeAvg.toFixed(1)})의 ±10% 이내. 어기면 그 거래는 취소되고, 성적 균형을 어기면 학부모 민원으로 신임 -5</span></h2>
      <div class="table-wrap"><table class="roster plain"><thead><tr><th>반</th><th>주인</th><th>인원</th><th>평균 능력</th><th>우리 계파 학생</th></tr></thead><tbody>
        ${balance.map((b) => { const off = Math.abs(b.avg - gradeAvg) > gradeAvg * 0.1, size = b.n < 28 || b.n > 32; return `<tr class="${b.c.owner === 'player' ? 'ours' : ''}"><td>${classLabel(b.c.id)}</td><td>${factionChip(b.c.owner)}</td>
          <td class="num ${size ? 'warn-text' : ''}">${b.n}</td><td class="num ${off ? 'warn-text' : ''}">${b.avg.toFixed(1)}</td><td class="num">${b.ours}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="note">편성이 끝나면 반마다 지지도를 다시 계산합니다: 이전 지지도 50% + 새 학생들의 소속 계파 비율 50%. 우리 계파 학생을 노리는 반에 모으면 그 반을 차지하기 쉬워집니다.</p>
    </section>

    <div class="row end"><button type="button" class="btn primary big" id="next">${mt.round >= ROUNDS ? '교감 승인 받기 ▶' : `${mt.round + 1}라운드로 ▶`}</button></div>
    ${mt.log.length ? `<section class="panel"><h2>회의 기록</h2><ul class="news">${[...mt.log].reverse().map((l) => `<li>${esc(l)}</li>`).join('')}</ul></section>` : ''}`;

  app.querySelector('#our-cls')?.addEventListener('change', (e) => { ui.ourCls = e.target.value; ui.give.clear(); ui.theirCls = null; rerender(); });
  app.querySelector('#their-cls')?.addEventListener('change', (e) => { ui.theirCls = e.target.value; ui.take = null; rerender(); });
  app.querySelectorAll('input[name=give]').forEach((c) => c.addEventListener('change', () => { if (c.checked) ui.give.add(c.value); else ui.give.delete(c.value); rerender(); }));
  app.querySelectorAll('input[name=take]').forEach((c) => c.addEventListener('change', () => { ui.take = c.value; rerender(); }));
  app.querySelector('#propose')?.addEventListener('click', () => { const r = proposeTrade([...ui.give], ui.take); if (r.ok) { ui.give.clear(); ui.take = null; } notify(r); });
  app.querySelectorAll('[data-offer]').forEach((b) => b.addEventListener('click', () => notify(answerOffer(+b.dataset.offer, b.dataset.accept === '1'))));
  app.querySelector('#next')?.addEventListener('click', () => notify(mt.round >= ROUNDS ? approve() : nextRound()));
}

