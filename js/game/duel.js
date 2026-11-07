// 대결 신청과 진행: 게임 상태(AP, 지지도, 학생)와 대결 엔진을 잇는다 (룰북 8.2, 9장)
// 대상은 반(교실) 또는 야외 구역이다. 야외 구역은 주인 계파의 대표 반이 지킨다.
import { getState, save, nextRng, addMessage, count, checkTitles } from './state.js';
import { makeRng, clamp } from './rng.js';
import { isVacation } from './calendar.js';
import { classById, rosterOf, transfer, placeById, placeInfo, championClass } from './school.js';
import { SPORTS, createMatch, playSegment, preTalk, aiTimeout, substitute, isUnlocked, fit, autoLineup, bestTactics, estimateWin } from './match.js';
import { FACTIONS, HOMEROOM_ID, classLabel } from '../content/factions.js';
import { makeClassRoster } from './students.js';
import { teacherStat, shiftMorale } from './turn.js';

export const DUEL_AP = 2;

// 대결 대상 정보
export function target(s, id) {
  const cls = classById(s, id);
  if (cls) {
    return { id, kind: 'class', label: classLabel(id), owner: cls.owner, cls, seed: cls.seed,
      teacher: cls.teacher.name, lead: cls.teacher.lead, team: classLabel(id), roster: () => rosterOf(s, cls) };
  }
  const p = placeById(s, id);
  if (!p) return null;
  const info = placeInfo(id);
  const champ = p.owner === 'player' ? null : championClass(s, p.owner);
  const seed = [...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 1e9;
  return {
    id, kind: 'place', placeKind: info.kind, label: info.name, owner: p.owner, place: p, info, seed: seed + s.turn,
    teacher: champ?.teacher.name ?? null, lead: champ?.teacher.lead ?? 10, team: champ ? classLabel(champ.id) : `${FACTIONS[p.owner]?.short ?? ''} 연합`,
    roster: () => (champ ? rosterOf(s, champ) : makeClassRoster(makeRng(seed), 1, s.turn, p.owner)),
  };
}

export function challengeBlock(s, t) {
  if (t.kind === 'class' && t.id === HOMEROOM_ID) return '우리 담임반입니다.';
  if (t.owner === 'player') return t.kind === 'class' ? '이미 우리가 점령한 반입니다.' : '이미 우리 땅입니다.';
  if (t.kind === 'place' && t.placeKind !== 'outdoor') return '대결로는 얻을 수 없는 곳입니다.';
  if (s.duel && !s.duel.m.done) return '진행 중인 대결을 먼저 끝내 주세요.';
  if (s.turn < 3) return '대결 신청은 3월 3주부터 할 수 있습니다.';
  if (isVacation(s.turn)) return '방학에는 대결을 할 수 없습니다.';
  if (s.school.challenged[t.id]) return '이번 주에 이미 도전한 곳입니다.';
  if (s.ap < DUEL_AP) return `AP가 부족합니다 (필요 ${DUEL_AP}).`;
  return null;
}

// 비 오는 주에는 야외 종목(축구·야구)이 농구로 바뀐다 (9.8).
export const actualSport = (s, sport) => (s.school.weather === '비' && SPORTS[sport].outdoor ? 'basketball' : sport);

// 홈 보정: 그 종목 경기장(운동장·무성관)의 주인이 도전자면 도전자가, 아니면 도전받은 쪽이 홈
export function homeSide(s, sport, attacker) {
  const venue = s.school.places.find((p) => placeInfo(p.id).venue?.includes(sport));
  return venue && venue.owner === attacker ? 'attacker' : 'defender';
}

const subjectBonus = (s) => (s.profile.subject === 'pe' ? 0.05 : 0); // 체육: 반 대항전이 강한 대결

export function playerSide(s, draft) {
  return {
    key: 'player', name: s.className, faction: 'player',
    lead: teacherStat('지도력'), bonus: subjectBonus(s), home: false,
    players: s.students, lineup: draft?.lineup, tactics: draft?.tactics,
  };
}

export function aiTactics(sport, rng) {
  const out = { ...SPORTS[sport].defaults };
  for (const [k, opt] of Object.entries(SPORTS[sport].options)) {
    if (opt.pre) continue;
    out[k] = rng.pick(opt.list.filter(isUnlocked)).key;
  }
  return out;
}

export function oppSide(s, t, sport, rng) {
  return {
    key: t.id, name: t.team, faction: t.owner, lead: t.lead, home: true, players: t.roster(),
    tactics: rng ? aiTactics(sport, rng) : undefined,
  };
}

// 반 전체의 종목별 평균 적합도
export function teamStrength(list, sport) {
  const pos = SPORTS[sport].positions(SPORTS[sport].defaults);
  const lu = autoLineup(list, pos);
  return lu.reduce((a, l) => a + fit(list.find((p) => p.id === l.id), l.pos), 0) / lu.length;
}

// 도전받는 쪽이 거부하는 종목: 자기가 가장 불리한 종목 하나. 무소속은 거부하지 않는다.
export function refusedSport(s, t, attackerRoster = s.students) {
  if (!FACTIONS[t.owner]?.refuses) return null;
  const theirs = t.roster();
  let worst = null;
  for (const sport of Object.keys(SPORTS)) {
    const r = teamStrength(theirs, sport) / teamStrength(attackerRoster, sport);
    if (!worst || r < worst.r) worst = { sport, r };
  }
  return worst.sport;
}

// 예상 승률. 교사 안목이 낮을수록 범위가 넓다.
export function preview(s, t, sport) {
  const real = actualSport(s, sport);
  const me = playerSide(s), op = oppSide(s, t, real);
  if (homeSide(s, real, 'player') === 'attacker') { me.home = true; op.home = false; }
  const est = estimateWin(real, me, op, (k) => makeRng(t.seed + k * 101 + s.turn * 7), 60);
  const eye = teacherStat('안목');
  const fuzz = (20 - eye) * 0.012;
  const bias = makeRng(t.seed + s.turn).gauss() * fuzz * 0.6;
  const mid = clamp(est.win + bias, 0.02, 0.98);
  return { sport: real, low: clamp(mid - fuzz, 0, 1), high: clamp(mid + fuzz, 0, 1), draw: est.draw, home: me.home };
}

export function autoSetup(s, sport, tactics) {
  const base = { ...playerSide(s), tactics: { ...SPORTS[sport].defaults, ...tactics } };
  const lineup = autoLineup(s.students, SPORTS[sport].positions(base.tactics));
  const combo = bestTactics(sport, { ...base, lineup }, (t) => makeRng(s.seed + t * 13 + s.turn), 24);
  return { lineup, tactics: { ...base.tactics, ...combo } };
}

const fail = (msg) => ({ ok: false, msg });
const done = (msg) => { checkTitles(); save(); return { ok: true, msg }; };

export function beginDuel(targetId, sport, draft) {
  const s = getState();
  const t = target(s, targetId);
  if (!t) return fail('없는 대상입니다.');
  const block = challengeBlock(s, t); if (block) return fail(block);
  if (sport === refusedSport(s, t)) return fail('상대가 거부한 종목입니다.');
  const real = actualSport(s, sport);
  const rng = nextRng();
  s.ap -= DUEL_AP;
  s.school.challenged[targetId] = true;
  const me = playerSide(s, draft), op = oppSide(s, t, real, rng);
  if (homeSide(s, real, 'player') === 'attacker') { me.home = true; op.home = false; }
  const m = createMatch(real, me, op, rng);
  if (draft.talk !== null && draft.talk !== undefined) preTalk(m, 0, draft.talk, teacherStat('동기부여'), rng);
  if (rng.next() < 0.7) preTalk(m, 1, rng.int(0, 2), 10, rng);
  s.duel = { classId: targetId, sport: real, asked: sport, m, result: null };
  return done(`${t.label}에 ${SPORTS[real].name} 대결을 신청했습니다.${real !== sport ? ' 비가 와서 농구로 바뀌었습니다.' : ''}`);
}

export function nextSegment() {
  const s = getState();
  const d = s.duel;
  if (!d || d.m.done) return fail('진행 중인 대결이 없습니다.');
  const rng = nextRng();
  if (d.m.seg > 0) aiTimeout(d.m, 1, rng);
  playSegment(d.m, rng);
  if (d.m.done) applyResult(s, d, rng);
  save();
  return { ok: true, msg: d.m.done ? '경기가 끝났습니다.' : `${SPORTS[d.sport].segs[d.m.seg - 1]}이(가) 끝났습니다. 작전 타임입니다.` };
}

export function setDuelTactic(key, value) {
  const s = getState();
  const d = s.duel;
  if (!d || d.m.done) return fail('진행 중인 대결이 없습니다.');
  const opt = SPORTS[d.sport].options[key];
  if (!opt || opt.pre) return fail('경기 중에는 바꿀 수 없습니다.');
  const o = opt.list.find((x) => x.key === value);
  if (!o || !isUnlocked(o)) return fail('아직 쓸 수 없는 전술입니다.');
  d.m.sides[0].tactics[key] = value;
  if (d.m.seg > 0) d.m.log.push({ seg: d.m.seg - 1, side: 0, text: `작전 지시: ${opt.label}을(를) "${value}"(으)로 바꿨습니다` });
  save();
  return { ok: true, msg: `${opt.label}: ${value}` };
}

export function duelSub(outId, inId) {
  const s = getState();
  const d = s.duel;
  if (!d || d.m.done) return fail('진행 중인 대결이 없습니다.');
  const err = substitute(d.m, 0, outId, inId);
  if (err) return fail(err);
  save();
  return { ok: true, msg: '교체했습니다.' };
}

// 대결 결과를 판도에 반영한다. 플레이어 대결과 AI 대결이 같이 쓴다.
// attacker, defender: 계파 키. 돌려주는 값: { moved, conquered, absorbed }
export function settle(s, t, attacker, defender, winnerIsAttacker, grade, rng, politics) {
  let moved = 0, conquered = false, absorbed = false;
  if (t.kind === 'class') {
    const cls = t.cls;
    if (winnerIsAttacker === true) {
      moved = transfer(cls, defender, attacker, grade.swing);
      if (cls.support[attacker] >= 50 && cls.id !== HOMEROOM_ID) {
        conquered = true;
        cls.owner = attacker;
        cls.lowTurns = 0;
        // 패배 담임 흡수: 30% + 정치력 × 2% (AI는 정치력 10으로 본다)
        if (rng.next() < 0.3 + politics * 0.02) { absorbed = true; cls.teacher.faction = attacker; }
      }
    } else if (winnerIsAttacker === false) {
      moved = -transfer(cls, attacker, defender, grade.swing, false);
    }
  } else if (winnerIsAttacker === true) {
    t.place.owner = attacker;
    conquered = true;
  }
  return { moved, conquered, absorbed };
}

function applyResult(s, d, rng) {
  const m = d.m;
  const t = target(s, d.classId);
  const g = m.grade;
  const owner = t.owner;
  const win = m.winner === 0 ? true : m.winner === 1 ? false : null;
  const { moved, conquered, absorbed } = settle(s, t, 'player', owner, win, g, rng, teacherStat('정치력'));
  if (t.kind === 'class') {
    const rec = t.cls.record;
    if (win === true) rec.w++; else if (win === false) rec.l++; else rec.d++;
  }
  if (win === true) count('duelWin');
  if (conquered) count(t.kind === 'class' ? 'conquer' : 'conquerPlace');
  if (absorbed) count('absorbed');

  // 출전 학생: 컨디션, 사기, 소량 성장, MVP 명성
  const mvpName = applyToStudents(s, m, 0, rng);

  d.result = { moved, conquered, absorbed, owner, kind: t.kind };
  const label = t.label;
  const res = m.winner === 0 ? g.label : m.winner === 1 ? (g.key === 'close' ? '석패' : '패배') : '무승부';
  const supportLine = t.kind === 'place' ? (win === true ? '' : win === false ? `${label}은(는) 그대로 ${FACTIONS[owner].name} 땅입니다.` : '비겨서 아무것도 바뀌지 않았습니다.')
    : m.winner === null ? '비겨서 지지도는 변하지 않았습니다.'
      : m.winner === 0 ? `${label} 우리 지지도 +${moved.toFixed(1)}%p (현재 ${Math.round(t.cls.support.player)}%).`
        : moved < 0 ? `${label} 우리 지지도 ${moved.toFixed(1)}%p (현재 ${Math.round(t.cls.support.player)}%).` : `${label}에는 원래 우리 지지도가 없어서 잃은 것은 없습니다.`;
  addMessage({
    kind: conquered ? 'info' : 'report',
    title: `${SPORTS[d.sport].name} 대결 ${res}: 1학년 4반 ${m.score[0]} : ${m.score[1]} ${t.team}${t.kind === 'place' ? ` (${label})` : ''}`,
    body: [
      supportLine,
      conquered ? `${label}을(를) 점령했습니다!${t.kind === 'class' ? (absorbed ? ` 담임 ${t.teacher} 선생님이 우리 계파에 들어왔습니다.` : ` 담임 ${t.teacher} 선생님은 ${FACTIONS[owner].name}에 남았습니다.`) : ''}` : '',
      t.kind === 'class' && m.winner === 0 && !conquered ? '점령하려면 지지도 50% 이상에서 이겨야 합니다.' : '',
      mvpName ? `MVP: ${mvpName}${m.mvp.si === 0 ? ' (우리 반, 명성 경험치 +60)' : ''}` : '',
    ].filter(Boolean).join('\n'),
  });
}

const GROW = { GK: ['운동신경', '집중력'], DF: ['피지컬', '집중력'], MF: ['체력', '협력'], FW: ['운동신경', '적극성'],
  PG: ['의사결정', '운동신경'], SG: ['운동신경', '집중력'], SF: ['운동신경', '피지컬'], PF: ['피지컬', '체력'], C: ['피지컬', '체력'],
  P: ['집중력', '운동신경'], RP: ['집중력', '운동신경'], CA: ['집중력', '의사결정'] };

// 우리 담임반 학생이 뛴 경기의 뒷정리. si: 우리 쪽 번호
export function applyToStudents(s, m, si, rng) {
  const side = m.sides[si];
  const won = m.winner === si, lost = m.winner === 1 - si;
  for (const id of side.used) {
    const st = s.students.find((x) => x.id === id);
    if (!st) continue;
    st.condition = side.players[id].condition;
    if (won && rng.next() < 0.6) shiftMorale(st, 1);
    if (lost && rng.next() < (st.stats['자존감'] >= 13 ? 0.25 : 0.5)) shiftMorale(st, -1);
    const pos = side.lineup.find((l) => l.id === id)?.pos ?? 'MF';
    for (const k of GROW[pos] ?? ['운동신경', '체력']) st.prog[k] = (st.prog[k] ?? 0) + 0.25;
  }
  if (!m.mvp) return '';
  const name = m.sides[m.mvp.si].players[m.mvp.id].name;
  if (m.mvp.si === si) { const st = s.students.find((x) => x.id === m.mvp.id); if (st) { st.fameExp += 60; shiftMorale(st, 1); } }
  return name;
}

export function closeDuel() {
  const s = getState();
  if (s.duel && !s.duel.m.done) return fail('경기가 아직 끝나지 않았습니다.');
  s.duel = null;
  save();
  return { ok: true, msg: '대결 결과를 정리했습니다.' };
}

export { autoLineup };
