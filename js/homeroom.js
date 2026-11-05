// 담임반 화면: FM의 선수단 목록처럼 30명을 한눈에 본다.
import { getState, newGame } from './game/state.js';
import { needLevel, topNeed } from './game/students.js';
import { NEEDS, MORALE } from './content/stats.js';
import { esc, stars, moralePill, needBar, traitBadge } from './ui.js';

const NEED_LABEL = Object.fromEntries(NEEDS.map((n) => [n.key, n.label]));
const COLS = [
  { key: 'no', label: '번호', get: (s) => s.no },
  { key: 'name', label: '이름', get: (s) => s.name },
  { key: 'personality', label: '성격', get: (s) => s.personality },
  { key: 'trait', label: '성향', get: (s) => s.trait },
  { key: 'morale', label: '사기', get: (s) => MORALE.indexOf(s.morale) },
  { key: 'need', label: '욕구', get: (s) => needLevel(s) },
  { key: 'ca', label: '현재 능력', get: (s) => s.ca },
  { key: 'pa', label: '포텐 (추정)', get: (s) => (s.estimate ? s.estimate.high : -1) },
  { key: 'room', label: '호실', get: (s) => s.room },
];
let sort = { key: 'no', dir: 1 };
let filter = 'all';
let confirmingReset = false;

export function renderHomeroom(app) {
  const st = getState();
  const list = st.students;
  const attention = list.filter((s) => needLevel(s) >= 70 || MORALE.indexOf(s.morale) <= 1);
  const avgNeed = Math.round(list.reduce((a, s) => a + needLevel(s), 0) / list.length);
  const moraleAvg = MORALE[Math.round(list.reduce((a, s) => a + MORALE.indexOf(s.morale), 0) / list.length)];

  const shown = list
    .filter((s) => filter === 'all' || (filter === 'unseen' ? !s.observed : attention.includes(s)))
    .sort((a, b) => {
      const c = COLS.find((x) => x.key === sort.key);
      const va = c.get(a), vb = c.get(b);
      return (typeof va === 'string' ? va.localeCompare(vb, 'ko') : va - vb) * sort.dir;
    });

  app.innerHTML = `
    <div class="bhead">
      <div><span class="badge">${esc(st.weekLabel)}</span><h1>${esc(st.className)} 담임반</h1></div>
      <div class="reset">${confirmingReset
        ? `<span class="note">새 학생들로 다시 시작할까요? 지금 반은 사라집니다.</span>
           <button class="btn" type="button" data-reset="no">취소</button><button class="btn danger" type="button" data-reset="yes">새로 시작</button>`
        : `<button class="btn" type="button" data-reset="ask">새 게임</button>`}</div>
    </div>
    <div class="tiles">
      <div class="tile-stat"><span class="lbl">인원</span><b>${list.length}명</b></div>
      <div class="tile-stat"><span class="lbl">반 평균 사기</span><b>${moraleAvg}</b></div>
      <div class="tile-stat"><span class="lbl">평균 욕구</span><b>${avgNeed}</b></div>
      <div class="tile-stat"><span class="lbl">주의가 필요한 학생</span><b>${attention.length}명</b><span class="note">욕구 70 이상이거나 사기 낮음 이하</span></div>
      ${st.turn === 1
        ? `<div class="tile-stat"><span class="lbl">무료 학생 관찰</span><b>${st.freeObservations}회 남음</b><span class="note">입학식 주간 한정</span></div>`
        : `<div class="tile-stat"><span class="lbl">관찰한 학생</span><b>${list.filter((x) => x.observed).length}명</b><span class="note">관찰은 학생 화면에서 1 AP</span></div>`}
    </div>
    <div class="filters" role="group" aria-label="보기">
      ${[['all', '전체'], ['attention', '주의 필요'], ['unseen', '관찰 안 한 학생']].map(([k, l]) =>
        `<button type="button" class="chip" aria-pressed="${filter === k}" data-filter="${k}">${l}</button>`).join('')}
    </div>
    <div class="table-wrap">
      <table class="roster">
        <thead><tr>${COLS.map((c) => `<th scope="col"><button type="button" data-sort="${c.key}">${c.label}${sort.key === c.key ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}</button></th>`).join('')}</tr></thead>
        <tbody>${shown.map((s) => `
          <tr data-id="${s.id}" tabindex="0">
            <td class="num">${s.no}</td>
            <td><a href="#s-${s.id}">${esc(s.name)}</a></td>
            <td>${s.personality}</td>
            <td>${traitBadge(s.trait)}</td>
            <td>${moralePill(s.morale)}</td>
            <td><span class="needcell">${needBar(needLevel(s))}<span class="note">${NEED_LABEL[topNeed(s)]}</span></span></td>
            <td>${stars(s.ca, '현재 능력')}</td>
            <td>${s.estimate ? stars(s.estimate.high, '포텐 추정') : '<span class="note">관찰 필요</span>'}</td>
            <td class="num">${s.room.slice(3)}</td>
          </tr>`).join('')}</tbody>
      </table>
    </div>
    <p class="note">학생을 누르면 상세 정보가 나옵니다. 포텐과 행운은 학생 관찰을 해야 보이고, 교사의 안목이 낮으면 추정이 빗나갈 수 있습니다.</p>`;

  app.querySelectorAll('[data-sort]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.sort;
    sort = sort.key === k ? { key: k, dir: -sort.dir } : { key: k, dir: k === 'no' || k === 'name' || k === 'room' ? 1 : -1 };
    renderHomeroom(app);
  }));
  app.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.filter; renderHomeroom(app); }));
  app.querySelectorAll('tr[data-id]').forEach((tr) => {
    const open = () => { location.hash = `s-${tr.dataset.id}`; };
    tr.addEventListener('click', (e) => { if (!e.target.closest('a')) open(); });
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
  });
  app.querySelectorAll('[data-reset]').forEach((b) => b.addEventListener('click', () => {
    const v = b.dataset.reset;
    if (v === 'yes') { newGame(); confirmingReset = false; filter = 'all'; }
    else confirmingReset = v === 'ask';
    renderHomeroom(app);
  }));

  return [{ label: '담임반' }];
}
