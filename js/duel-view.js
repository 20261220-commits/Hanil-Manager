// 대결 화면: 종목 고르기 → 명단·전술·훈화 → 구간 진행과 작전 타임 → 결과 (룰북 9장)
import { getState } from './game/state.js';
import { SPORTS, isUnlocked, fit, POS_LABEL } from './game/match.js';
import { target, challengeBlock, refusedSport, preview, autoSetup, beginDuel, nextSegment, setDuelTactic, duelSub, closeDuel, actualSport, homeSide, DUEL_AP,
  scout, scouted, judgeOf, audienceOf, oppTacticsOf, SCOUT_AP, scheduleEvent, investPrep, prepGain, EVENT_INVEST_AP, EVENT_INVEST_MONEY, EVENT_MONEY_CAP } from './game/duel.js';
import { JUDGE_LABEL, AUDIENCES } from './game/match.js';
import { weekLabel } from './game/calendar.js';
import { FACTIONS } from './content/factions.js';
import { PERSONALITIES, TALKS } from './content/personality.js';
import { notify, toast } from './chrome.js';
import { esc, moralePill } from './ui.js';
import { factionChip, supportBar } from './school-view.js';

const PERS = Object.fromEntries(PERSONALITIES.map((p) => [p.name, p]));
let draft = null;
const previews = new Map();
function cachedPreview(s, cls, sport) {
  const k = `${cls.id}|${s.turn}|${s.school.weather}|${sport}`;
  if (!previews.has(k)) previews.set(k, preview(s, cls, sport));
  return previews.get(k);
}
const pct = (x) => `${Math.round(x * 100)}%`;
const one = (x) => x.toFixed(1);

export function renderDuel(app, classId) {
  const s = getState();
  if (s.duel && s.duel.classId !== classId) { location.hash = `duel-${s.duel.classId}`; return [{ label: '교내 판도', href: '#school' }, { label: '대결' }]; }
  const cls = target(s, classId);
  if (!cls) { app.innerHTML = '<div class="panel empty"><h1>없는 대상입니다</h1><a class="btn" href="#school">교내 판도로</a></div>'; return [{ label: '교내 판도', href: '#school' }]; }
  const crumbs = [{ label: '교내 판도', href: '#school' }, { label: `${cls.label} 대결` }];
  if (s.duel) renderMatch(app, s, cls);
  else renderSetup(app, s, cls);
  return crumbs;
}

// ---------- 준비 ----------

function renderSetup(app, s, cls) {
  if (!draft || draft.classId !== cls.id) draft = { classId: cls.id, sport: null, tactics: null, lineup: null, talk: 1 };
  if (s.school.preps?.[cls.id]) { renderPrep(app, s, cls); return; }
  const block = challengeBlock(s, cls);
  const seen = scouted(s, cls.id);
  const refused = refusedSport(s, cls);
  const head = `
    <div class="bhead"><div><span class="badge">${esc(s.weekLabel)}</span><h1>${esc(cls.label)}에 도전</h1></div>
      <div class="duel-opp">${factionChip(cls.owner)} <span class="note">${cls.teacher ? `${cls.kind === 'place' ? `지키는 반 ${esc(cls.team)} · ` : ''}담임 ${esc(cls.teacher)} 선생님 · 지도력 ${cls.lead}` : `${esc(cls.team)}이 지킵니다`}</span></div></div>
    ${cls.kind === 'class' ? `<section class="panel"><div class="row between"><h2>지금 지지도</h2><span class="note">우리 ${Math.round(cls.cls.support.player)}% · ${FACTIONS[cls.owner].short} ${Math.round(cls.cls.support[cls.owner])}%</span></div>
      ${supportBar(cls.cls.support)}
      <p class="note">이기면 압승 +20%p, 승리 +12%p, 신승 +5%p를 ${FACTIONS[cls.owner].name} 쪽에서 가져옵니다. 지면 이 반의 우리 지지도를 같은 만큼 잃습니다.
        이긴 뒤 우리 지지도가 50% 이상이면 이 반을 점령합니다. 상대는 홈이라 팀 전력 ×1.05를 받습니다 (그 종목 경기장을 우리가 가졌으면 우리가 홈).</p></section>`
    : `<section class="panel"><h2>${esc(cls.label)} <span class="note">야외 구역 · ${esc(cls.info.bonus)}</span></h2>
      <p class="note">야외 구역은 지지도 없이 대결 한 번으로 주인이 바뀝니다. 이기면 바로 점령하고, 지면 잃는 것은 AP뿐입니다. ${FACTIONS[cls.owner].name}의 대표 반(${esc(cls.team)})이 지킵니다.</p></section>`}`;

  if (block) {
    app.innerHTML = `${head}<div class="panel empty"><h2>지금은 도전할 수 없습니다</h2><p class="muted">${esc(block)}</p><a class="btn" href="#school">교내 판도로</a></div>`;
    return;
  }

  // 1. 종목 (반 대항전 3종목 · 토론 · 행사 기획)
  const GROUP = { sport: '반 대항전', debate: '토론', event: '행사 기획' };
  const sportCards = Object.entries(SPORTS).map(([key, sp]) => {
    const no = key === refused;
    const real = actualSport(s, key);
    const pv = no ? null : cachedPreview(s, cls, key);
    const extraNote = key === 'debate' ? ` · 심사위원 ${seen ? JUDGE_LABEL[judgeOf(s, cls)].split(' (')[0] : '? (상대 분석으로 확인)'}`
      : key === 'event' ? ` · ${SPORTS.event.prepWeeks}주 준비 후 대결 · 관객 ${audienceOf(s, cls)}` : '';
    return `<button type="button" class="sport ${draft.sport === key ? 'is-on' : ''}" data-sport="${key}" ${no ? 'disabled' : ''}>
      <span class="note">${GROUP[sp.group]}</span>
      <b>${sp.name}</b><span class="note">${sp.venue}${real !== key ? ' · 비가 와서 농구로 진행' : ''}${!no && homeSide(s, real, 'player') === 'attacker' ? ' · 우리 경기장이라 우리가 홈' : ''}${extraNote}</span>
      ${no ? `<span class="warn-text">${FACTIONS[cls.owner].short} 쪽이 거부한 종목</span>`
        : `<span>예상 승률 <b>${pct(pv.low)}~${pct(pv.high)}</b>${pv.draw > 0.05 ? ` <span class="note">무승부 ${pct(pv.draw)}</span>` : ''}</span>`}
    </button>`;
  }).join('');

  let prep = '';
  if (draft.sport) {
    const sport = actualSport(s, draft.sport);
    const sp = SPORTS[sport];
    if (!draft.lineup || draft.forSport !== sport) {
      Object.assign(draft, autoSetup(s, sport, {}, cls), { forSport: sport });
    }
    const inLineup = new Set(draft.lineup.map((l) => l.id));
    const bench = s.students.filter((st) => !inLineup.has(st.id));
    const talkCount = TALKS.map((_, i) => ({
      good: draft.lineup.filter((l) => PERS[byId(s, l.id).personality].talk[i] === '◎').length,
      bad: draft.lineup.filter((l) => PERS[byId(s, l.id).personality].talk[i] === '✕').length,
    }));
    prep = `
      <section class="panel">
        <div class="row between"><h2>2. 전술 <span class="note">${sp.name}</span></h2>
          <button type="button" class="btn" id="auto">자동 설정</button></div>
        <p class="note">자동 설정은 학생마다 가장 잘 맞는 자리에 넣고, 쓸 수 있는 전술을 모두 시험해 승률이 가장 높은 조합을 고릅니다. 종목을 몰라도 이 버튼만 누르면 됩니다.</p>
        ${tacticSelects(sp, draft.tactics, true)}
        ${sport === 'debate' ? `<p class="note">상성: 논리형 > 공격형 > 감성형 > 논리형 (유리 ×1.15, 불리 ×0.90). 심사위원 성향과 같은 스타일은 ×1.10.${seen ? ` 이번 주 심사위원: <b>${JUDGE_LABEL[judgeOf(s, cls)]}</b> · 상대 스타일: <b>${oppTacticsOf(s, cls, 'debate').style}</b>` : ''}</p>` : ''}
        ${sport === 'event' ? `<p class="note">관객: <b>${audienceOf(s, cls)}</b> (맞는 콘셉트: ${AUDIENCES[audienceOf(s, cls)]}, 맞으면 ×1.15 · 안 맞으면 ×0.90). 콘셉트와 명단은 날짜를 잡을 때 정해지고, 준비 기간 동안 준비도를 쌓습니다.</p>` : ''}
      </section>
      <section class="panel">
        <h2>3. 명단 <span class="note">자리를 바꾸면 그 학생과 자리를 맞바꿉니다 · 적합도는 그 자리 가중치로 낸 점수</span></h2>
        <div class="table-wrap"><table class="roster lineup"><thead><tr><th>자리</th><th>학생</th><th>적합도</th><th>컨디션</th><th>사기</th></tr></thead><tbody>
          ${draft.lineup.map((l, i) => { const st = byId(s, l.id); return `<tr>
            <td>${POS_LABEL[l.pos]}</td>
            <td><select data-slot="${i}" aria-label="${POS_LABEL[l.pos]} 자리">${s.students.filter((x) => !((x.outUntil ?? 0) > s.turn)).map((x) => `<option value="${x.id}" ${x.id === l.id ? 'selected' : ''}>${esc(x.name)} (${one(fit(x, l.pos))})</option>`).join('')}</select></td>
            <td class="num">${one(fit(st, l.pos))}</td><td class="num ${st.condition < 70 ? 'warn-text' : ''}">${st.condition}%</td><td>${moralePill(st.morale)}</td></tr>`; }).join('')}
        </tbody></table></div>
        <p class="note">벤치 ${bench.length}명 · 교체 ${sp.subs >= 10 ? '자유' : `${sp.subs}번`}. 컨디션이 낮으면 전력이 떨어집니다 (80% ×0.93, 60% ×0.85).</p>
      </section>
      <section class="panel">
        <h2>4. 경기 전 훈화</h2>
        <div class="segs">${[['없음', null], ...TALKS.map((t, i) => [t, i])].map(([name, i]) => `<label class="seg"><input type="radio" name="talk" value="${i ?? ''}" ${draft.talk === i ? 'checked' : ''}><span>${name}${i !== null ? ` · ◎ ${talkCount[i].good} ✕ ${talkCount[i].bad}` : ''}</span></label>`).join('')}</div>
        <p class="note">압박은 승부욕·적극성, 격려는 사기, 침착은 평정심·집중력을 올립니다. ✕인 학생에게는 역효과가 납니다.</p>
      </section>
      <div class="row end"><button type="button" class="btn primary big" id="start" ${s.ap < DUEL_AP ? 'disabled' : ''}>${sport === 'event' ? `행사 날짜 잡기 (${DUEL_AP} AP, ${SPORTS.event.prepWeeks}주 뒤)` : `경기 시작 (${DUEL_AP} AP)`}</button></div>`;
  }

  app.innerHTML = `${head}
    <section class="panel"><div class="row between"><h2>1. 종목</h2>
        ${seen ? '<span class="pill good">상대 분석 완료</span>' : `<button type="button" class="btn small" id="scout" ${s.ap < SCOUT_AP ? 'disabled' : ''}>상대 분석 (${SCOUT_AP} AP)</button>`}</div>
      <div class="sport-grid">${sportCards}</div>
      ${seen && draft.sport && SPORTS[draft.sport].group !== 'event' ? `<p class="note">상대 분석: 이번 주 ${SPORTS[actualSport(s, draft.sport)].name} 전술은 <b>${Object.values(oppTacticsOf(s, cls, actualSport(s, draft.sport))).join(' · ')}</b></p>` : ''}
      <p class="note">도전받는 쪽은 한 종목을 거부할 수 있습니다 (무소속은 거부하지 않음). 예상 승률은 교사 안목으로 어림한 값이라, 안목이 낮으면 범위가 넓고 틀릴 수 있습니다. 경기 당일 컨디션 때문에 이변도 자주 납니다.</p>
    </section>${prep}`;

  app.querySelector('#scout')?.addEventListener('click', () => { const r = scout(cls.id); if (r.ok) draft.lineup = null; notify(r); });
  app.querySelectorAll('[data-sport]').forEach((b) => b.addEventListener('click', () => {
    draft.sport = b.dataset.sport; draft.lineup = null; draft.tactics = null;
    rerender();
  }));
  if (!draft.sport) return;
  app.querySelector('#auto').addEventListener('click', () => {
    Object.assign(draft, autoSetup(s, draft.forSport, {}, cls));
    toast('자동 설정을 마쳤습니다.');
    rerender();
  });
  app.querySelectorAll('select[data-opt]').forEach((sel) => sel.addEventListener('change', () => {
    const sp = SPORTS[draft.forSport];
    draft.tactics[sel.dataset.opt] = sel.value;
    if (sp.options[sel.dataset.opt].pre) draft.lineup = autoSetup(s, draft.forSport, draft.tactics).lineup;
    rerender();
  }));
  app.querySelectorAll('select[data-slot]').forEach((sel) => sel.addEventListener('change', () => {
    const i = +sel.dataset.slot;
    const j = draft.lineup.findIndex((l) => l.id === sel.value);
    if (j >= 0) draft.lineup[j].id = draft.lineup[i].id;
    draft.lineup[i].id = sel.value;
    rerender();
  }));
  app.querySelectorAll('input[name=talk]').forEach((r) => r.addEventListener('change', () => { draft.talk = r.value === '' ? null : +r.value; }));
  app.querySelector('#start').addEventListener('click', () => {
    const plan = { lineup: draft.lineup.map((l) => ({ ...l })), tactics: { ...draft.tactics }, talk: draft.talk };
    const r = draft.forSport === 'event' ? scheduleEvent(cls.id, plan) : beginDuel(cls.id, draft.sport, plan);
    if (r.ok) draft = null;
    notify(r);
  });
}

// 행사 기획 준비 화면 (3주)
function renderPrep(app, s, cls) {
  const prep = s.school.preps[cls.id];
  const day = s.turn >= prep.due;
  const spent = prep.money[s.turn] ?? 0;
  const match = AUDIENCES[prep.audience] === prep.tactics.concept;
  app.innerHTML = `
    <div class="bhead"><div><span class="badge">${esc(s.weekLabel)}</span><h1>${esc(cls.label)} 행사 기획 대결</h1></div>
      <div class="duel-opp">${factionChip(cls.owner)} <span class="note">행사일 ${weekLabel(prep.due)}${day ? ' · 오늘' : ` · ${prep.due - s.turn}주 남음`}</span></div></div>
    <section class="panel ${day ? 'agenda' : ''}">
      <div class="row between"><h2>준비도 ${prep.readiness} / 100</h2><span class="note">준비도 배율 ×${(0.7 + prep.readiness * 0.004).toFixed(2)} (0.70 ~ 1.10)</span></div>
      <span class="meter wide ${prep.readiness >= 70 ? 'ok' : prep.readiness >= 40 ? 'mid' : 'warn'}"><i style="width:${prep.readiness}%"></i></span>
      ${day ? '<p>행사 당일입니다. 무대에 올리세요. 이번 주에 치르지 않으면 주말에 자동으로 치릅니다.</p>' : `
      <p class="note">매주 자동으로 +${prepGain(s, prep)} (기획 담당 기획력 + 운영 담당 실행력, 총괄 통솔). 더 쌓으려면:</p>
      <div class="row">
        <button type="button" class="btn" id="inv-ap" ${s.ap < EVENT_INVEST_AP || prep.readiness >= 100 ? 'disabled' : ''}>준비 지도 (${EVENT_INVEST_AP} AP, +10)</button>
        <button type="button" class="btn" id="inv-money" ${s.budget < EVENT_INVEST_MONEY || spent + EVENT_INVEST_MONEY > EVENT_MONEY_CAP || prep.readiness >= 100 ? 'disabled' : ''}>준비 투자 (${EVENT_INVEST_MONEY}만원, +10)</button>
        <span class="note">이번 주 투자 ${spent} / ${EVENT_MONEY_CAP}만원 · 예산 ${s.budget}만원</span>
      </div>`}
      <p class="note">관객 <b>${prep.audience}</b> · 우리 콘셉트 <b>${prep.tactics.concept}</b> ${match ? '<span class="pill good">관객과 맞음 ×1.15</span>' : '<span class="pill warn">관객과 안 맞음 ×0.90</span>'}
        · 상대 준비도 ${scouted(s, cls.id) ? `<b>${prep.oppReady}</b>` : '? (상대 분석으로 확인)'}</p>
      ${scouted(s, cls.id) ? '' : `<button type="button" class="btn small" id="scout" ${s.ap < SCOUT_AP ? 'disabled' : ''}>상대 분석 (${SCOUT_AP} AP)</button>`}
    </section>
    <section class="panel"><h2>무대에 설 학생</h2>
      <div class="table-wrap"><table class="roster plain"><tbody>${prep.lineup.map((l) => { const st = byId(s, l.id); return `<tr><td>${POS_LABEL[l.pos]}</td><td><b>${esc(st.name)}</b></td><td class="num">${one(fit(st, l.pos))}</td><td class="num">${st.condition}%</td></tr>`; }).join('')}</tbody></table></div>
    </section>
    ${day ? '<div class="row end"><button type="button" class="btn primary big" id="go">행사 시작 ▶</button></div>' : ''}`;
  app.querySelector('#inv-ap')?.addEventListener('click', () => notify(investPrep(cls.id, 'ap')));
  app.querySelector('#inv-money')?.addEventListener('click', () => notify(investPrep(cls.id, 'money')));
  app.querySelector('#scout')?.addEventListener('click', () => notify(scout(cls.id)));
  app.querySelector('#go')?.addEventListener('click', () => notify(beginDuel(cls.id, 'event', {})));
}

const byId = (s, id) => s.students.find((x) => x.id === id);
const rerender = () => window.dispatchEvent(new CustomEvent('game:changed'));

function tacticSelects(sp, tactics, pre) {
  return `<div class="tactics">${Object.entries(sp.options).filter(([, o]) => pre || !o.pre).map(([k, o]) => `
    <label><span>${o.label}</span><select data-opt="${k}">${o.list.map((x) => `<option value="${x.key}" ${tactics[k] === x.key ? 'selected' : ''} ${isUnlocked(x) ? '' : 'disabled'}>${x.key} — ${x.desc}${isUnlocked(x) ? '' : ` (잠김: 교육과정 ${x.lock})`}</option>`).join('')}</select></label>`).join('')}</div>`;
}

// ---------- 경기 ----------

function renderMatch(app, s, cls) {
  const d = s.duel, m = d.m, sp = SPORTS[d.sport];
  const [A, B] = m.sides;
  const segPills = sp.segs.map((name, i) => `<li class="${i < m.seg ? 'done' : i === m.seg && !m.done ? 'now' : ''}">${name}${m.segScore[i] ? ` <b>${m.segScore[i][0]}:${m.segScore[i][1]}</b>` : ''}</li>`).join('');
  // 색은 우리 쪽 기준: 상대의 행운은 우리에게 나쁜 소식이다.
  const flip = { good: 'bad', bad: 'good' };
  const log = [...m.log].reverse().map((e) => `<li class="${e.side === 1 ? flip[e.tone] ?? e.tone ?? '' : e.tone ?? ''} ${e.side === 0 ? 'ours' : e.side === 1 ? 'theirs' : ''}">${esc(e.text)}</li>`).join('');

  const lineupTable = (side, si) => `<div class="table-wrap"><table class="roster lineup"><thead><tr><th>자리</th><th>학생</th><th>컨디션</th>${m.done ? '<th>평점</th>' : '<th>기록</th>'}</tr></thead><tbody>
    ${side.lineup.map((l) => { const p = side.players[l.id]; return `<tr><td>${POS_LABEL[l.pos]}</td><td>${esc(p.name)}${m.mvp && m.mvp.si === si && m.mvp.id === l.id ? ' <span class="pill good">MVP</span>' : ''}</td>
      <td class="num ${p.condition < 65 ? 'warn-text' : ''}">${p.condition}%</td><td class="num">${m.done ? (m.ratings[si][l.id]?.toFixed(1) ?? '-') : statLine(m.sport, side.stats[l.id])}</td></tr>`; }).join('')}
    ${m.done ? side.used.filter((id) => !side.lineup.some((l) => l.id === id)).map((id) => `<tr class="subbed"><td>교체됨</td><td>${esc(side.players[id].name)}</td><td class="num">${side.players[id].condition}%</td><td class="num">${m.ratings[si][id]?.toFixed(1) ?? '-'}</td></tr>`).join('') : ''}
  </tbody></table></div>`;

  let control = '';
  if (!m.done) {
    const benchList = Object.values(A.players).filter((p) => !A.lineup.some((l) => l.id === p.id));
    control = `<section class="panel timeout">
      <h2>${m.seg === 0 ? '경기 시작 전' : '작전 타임'} <span class="note">전술 변경은 무료 · 교체 ${A.subsLeft}번 남음</span></h2>
      ${tacticSelects(sp, A.tactics, false)}
      ${m.seg > 0 && A.subsLeft > 0 ? `<div class="row"><select id="sub-out" aria-label="나갈 학생">${A.lineup.filter((l) => l.pos !== 'RP').map((l) => `<option value="${l.id}">${esc(A.players[l.id].name)} (${POS_LABEL[l.pos]}, ${A.players[l.id].condition}%)</option>`).join('')}</select>
        <span aria-hidden="true">→</span>
        <select id="sub-in" aria-label="들어갈 학생">${benchList.map((p) => `<option value="${p.id}">${esc(p.name)} (${p.condition}%)</option>`).join('')}</select>
        <button type="button" class="btn" id="sub">교체</button></div>` : ''}
      <div class="row end"><button type="button" class="btn primary big" id="play">${sp.segs[m.seg]} ${m.seg === 0 ? '시작' : '진행'} ▶</button></div>
    </section>`;
  } else {
    const r = d.result;
    const res = m.winner === 0 ? m.grade.label : m.winner === 1 ? (m.grade.key === 'close' ? '석패' : '패배') : '무승부';
    const tone = m.winner === 0 ? 'good' : m.winner === 1 ? 'bad' : '';
    const mvp = m.mvp ? m.sides[m.mvp.si].players[m.mvp.id] : null;
    control = `<section class="panel result ${tone}">
      <h2 class="result-head">${res}</h2>
      <ul class="result-list">
        ${cls.kind === 'place' ? (r.conquered ? '' : `<li>${esc(cls.label)}은(는) 그대로 ${FACTIONS[r.owner].name} 땅입니다.</li>`)
          : `<li>${m.winner === null ? '비겨서 지지도는 그대로입니다.' : m.winner === 1 && r.moved === 0 ? `${esc(cls.label)}에는 원래 우리 지지도가 없어서 잃은 것은 없습니다.`
            : `${esc(cls.label)} 우리 지지도 <b>${r.moved > 0 ? '+' : ''}${one(r.moved)}%p</b> → ${Math.round(cls.cls.support.player)}%`}</li>`}
        ${r.conquered ? `<li><b>${esc(cls.label)}을(를) 점령했습니다!</b> ${cls.kind === 'place' ? '' : r.absorbed ? `담임 ${esc(cls.teacher)} 선생님이 우리 계파에 들어왔습니다.` : `담임 ${esc(cls.teacher)} 선생님은 ${FACTIONS[r.owner].name}에 남았습니다.`}</li>` : ''}
        ${cls.kind === 'class' && m.winner === 0 && !r.conquered ? `<li class="note">점령하려면 이긴 뒤 우리 지지도가 50% 이상이어야 합니다. 몇 번 더 이기거나 수업·영향력으로 지지도를 올려 주세요.</li>` : ''}
        ${mvp ? `<li>MVP: <b>${esc(mvp.name)}</b> (${m.mvp.si === 0 ? '우리 반, 명성 경험치 +60' : esc(m.sides[1].name)}) · 평점 ${m.mvp.r}</li>` : ''}
        <li class="note">출전한 우리 학생은 쓰인 스탯이 조금 자라고, 이기면 사기가 오르고 지면 떨어질 수 있습니다. 경기로 떨어진 컨디션은 그대로 남습니다.</li>
      </ul>
      <div class="row end"><button type="button" class="btn primary big" id="close">결과 확인</button></div>
    </section>`;
  }

  app.innerHTML = `
    <div class="bhead"><div><span class="badge">${sp.name} · ${sp.venue}${d.asked !== d.sport ? ' (비 때문에 종목 변경)' : ''}${m.judge ? ` · 심사위원: ${JUDGE_LABEL[m.judge]}` : ''}${m.audience ? ` · 관객: ${m.audience} · 준비도 ${A.readiness ?? '-'} 대 ${B.readiness ?? '-'}` : ''}</span><h1>${esc(A.name)} 대 ${esc(B.name)}</h1></div>
      <div class="duel-opp">${factionChip('player', '우리')} ${factionChip(d.result?.owner ?? cls.owner)}</div></div>
    <section class="scoreboard">
      <div class="team ours"><span>${esc(A.name)}</span><span class="note">${A.home ? '홈' : '원정'} · 당일 컨디션 ${tag(A.form)}</span></div>
      <div class="score"><b>${m.score[0]}</b><span>:</span><b>${m.score[1]}</b></div>
      <div class="team theirs"><span>${esc(B.name)}</span><span class="note">${B.home ? '홈' : '원정'} · 당일 컨디션 ${m.seg > 0 ? tag(B.form) : '?'}</span></div>
      <ol class="segbar">${segPills}</ol>
    </section>
    ${control}
    <div class="match-cols">
      <section class="panel"><h2>경기 기록</h2>${log ? `<ol class="mlog">${log}</ol>` : '<p class="note">아직 기록이 없습니다.</p>'}</section>
      <section class="panel"><h2>${esc(A.name)} <span class="note">${tacticsText(A.tactics)}</span></h2>${lineupTable(A, 0)}</section>
      <section class="panel"><h2>${esc(B.name)} <span class="note">${m.seg > 0 ? tacticsText(B.tactics) : '전술 비공개'}</span></h2>${lineupTable(B, 1)}</section>
    </div>`;

  app.querySelectorAll('select[data-opt]').forEach((sel) => sel.addEventListener('change', () => notify(setDuelTactic(sel.dataset.opt, sel.value))));
  app.querySelector('#play')?.addEventListener('click', () => notify(nextSegment()));
  app.querySelector('#sub')?.addEventListener('click', () => notify(duelSub(app.querySelector('#sub-out').value, app.querySelector('#sub-in').value)));
  app.querySelector('#close')?.addEventListener('click', () => { const r = closeDuel(); toast(r.msg, !r.ok); if (r.ok) location.hash = 'school'; });
}

const tag = (f) => (f >= 1.12 ? '아주 좋음' : f >= 1.04 ? '좋음' : f > 0.96 ? '보통' : f > 0.88 ? '나쁨' : '아주 나쁨');
const tacticsText = (t) => Object.values(t).join(' · ');

function statLine(sport, st = {}) {
  if (sport === 'debate' || sport === 'event') return st.won ? `${st.won}구간 승` : '';
  if (sport === 'soccer') return st.goals ? `${st.goals}골` : '';
  if (sport === 'basketball') return [st.pts ? `${st.pts}점` : '', st.reb ? `리바 ${st.reb}` : ''].filter(Boolean).join(' ');
  const ip = st.outs ? `${Math.floor(st.outs / 3)}${['', '⅓', '⅔'][st.outs % 3]}이닝` : '';
  return [st.pa ? `${st.h ?? 0}/${st.pa}` : '', st.hr ? `홈런 ${st.hr}` : '', ip].filter(Boolean).join(' ');
}

