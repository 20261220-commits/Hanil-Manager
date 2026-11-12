// 반 편성 회의 = 학년 말 이적시장 (룰북 10장)
// 1월 1주 ~ 2월 3주 (그해 41~47턴): 사전 협상 — 신입생 명단 공개, 중학교 탐방, 동료 교사 친목
// 2월 4주 (48턴): 회의 — 업무 분장 → 성적순 S자 기본 배정 → 협상 3라운드 → 교감 승인 → 지지도 재계산
// 반 타일은 학년-반 자리라서 주인은 그대로 남고, 학생이 새로 들어온다 (10.1).
import { getState, save, nextRng, addMessage, count, checkTitles } from './state.js';
import { makeRng, clamp } from './rng.js';
import { makeFreshman, toCompact, fromCompact, calcCA } from './students.js';
import { rosterOf, classById, transfer } from './school.js';
import { teacherStat, shiftMorale } from './turn.js';
import { yearTurn, yearOf } from './calendar.js';
import { placeById } from './school.js';
import { STATS, STAT_GROUPS } from '../content/stats.js';
import { TRAITS } from '../content/traits.js';
import { FACTION_KEYS, AI_FACTIONS, FACTIONS, HOMEROOM_ID, classLabel } from '../content/factions.js';

export const PRE_START = 41, GRADUATION = 47, MEETING = 48;
export const ROUNDS = 3, PROPOSALS_PER_ROUND = 3;
export const SCOUT_AP = 1, FRIEND_AP = 1;
const SIZE_MIN = 28, SIZE_MAX = 32;
const GRADE_COEF = { 1: 0.5, 2: 0.3, 3: 0.1 };
const MIND = STAT_GROUPS[1].stats, BODY = STAT_GROUPS[2].stats;
const idx = (k) => STATS.indexOf(k);

const fail = (msg) => ({ ok: false, msg });
const done = (msg) => { checkTitles(); save(); return { ok: true, msg }; };

export const inPre = (s) => { const t = yearTurn(s.turn); return t >= PRE_START && t < MEETING; };
export const isMeetingWeek = (s) => yearTurn(s.turn) === MEETING;

// ---------- 사전 협상 ----------

const RUMOR = {
  '-10': '중학교 때 전국 대회를 휩쓸었다는 소문', '-9': '중학교 때 유명했대', '-8': '선생님들이 눈여겨본 학생이래',
  '-7': '꽤 잘했다는 이야기', '-6': '성실하다는 평', '-5': '특별한 소문은 없음', '-4': '특별한 소문은 없음',
};

function generateFreshmen(s, year) {
  const rng = makeRng(s.seed * 101 + year * 7919);
  const used = new Set();
  const list = [];
  for (let i = 0; i < 240; i++) {
    const st = makeFreshman(rng, used, { grade: 1 });
    st.id = `f${year + 1}-${String(i + 1).padStart(3, '0')}`;
    st.faction = 'none';
    const c = toCompact(st, s.turn);
    c.rumor = RUMOR[st.potTier] ?? '특별한 소문은 없음';
    c.pub = rng.shuffle(STATS).slice(0, 3); // 공개된 스탯 3개
    list.push(c);
  }
  return list;
}

export function ensureMeeting(s) {
  if (yearTurn(s.turn) < PRE_START) return null;
  const year = yearOf(s.turn);
  if (!s.meeting || s.meeting.year !== year) {
    s.meeting = { year, phase: 'pre', freshmen: generateFreshmen(s, year), scouted: {}, friends: {}, round: 0, left: 0, next: null, trades: [], offers: [], log: [] };
  }
  return s.meeting;
}

// 중학교 탐방 (1 AP): 신입생 3명의 숨김 정보(포텐, 성향)를 미리 본다
export function scoutFreshmen(ids) {
  const s = getState();
  const mt = ensureMeeting(s);
  if (!mt || !inPre(s)) return fail('중학교 탐방은 사전 협상 기간(1월~2월 3주)에만 할 수 있습니다.');
  const list = [...new Set(ids)].filter((id) => mt.freshmen.some((c) => c.id === id) && !mt.scouted[id]);
  if (!list.length || list.length > 3) return fail('아직 탐방하지 않은 신입생을 1~3명 골라 주세요.');
  if (s.ap < SCOUT_AP) return fail(`AP가 부족합니다 (필요 ${SCOUT_AP}).`);
  s.ap -= SCOUT_AP;
  for (const id of list) mt.scouted[id] = true;
  return done(`중학교 탐방으로 신입생 ${list.length}명의 숨은 정보를 알아냈습니다.`);
}

// 동료 교사 친목 (1 AP): 관계 +5, 계파마다 주 1회
export function befriend(f) {
  const s = getState();
  const mt = ensureMeeting(s);
  if (!mt || !inPre(s)) return fail('친목은 사전 협상 기간에만 할 수 있습니다.');
  if (mt.friends[f] === s.turn) return fail('이번 주에 이미 만났습니다.');
  if (s.ap < FRIEND_AP) return fail(`AP가 부족합니다 (필요 ${FRIEND_AP}).`);
  s.ap -= FRIEND_AP;
  mt.friends[f] = s.turn;
  s.school.rel[f] = clamp((s.school.rel[f] ?? 0) + 5, -100, 100);
  return done(`${FACTIONS[f].name} 선생님들과 밥을 먹었습니다. 관계 +5.`);
}

// ---------- 학생 가치 (10.4) ----------

// 우리가 보는 추정 포텐: 관찰했으면 그 값, 아니면 안목에 따라 흔들린 값 (학생마다 고정)
export function ourEstimate(s, c) {
  const width = (20 - teacherStat('안목')) * 1.2;
  return Math.round(c.p + makeRng(s.seed + hash(c.id)).gauss() * width);
}
// AI가 보는 추정 포텐: AI 교사 안목을 10으로 보고 흔든다 (그래서 원석을 싸게 데려올 수 있다)
const aiEstimate = (s, c) => Math.round(c.p + makeRng(s.seed * 3 + hash(c.id)).gauss() * 12);
const hash = (str) => [...str].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 1e9, 7);

const caOf = (c) => calcCA(Object.fromEntries(STATS.map((k, i) => [k, c.s[i]])));
const traitBonus = (c) => { const t = TRAITS.find((x) => x.name === c.t); return t ? (t.tone === '부정' ? -10 : t.rarity === '전설' ? 20 : t.rarity === '희귀' ? 10 : 0) : 0; };
export function valueOf(c, grade, est) {
  const ca = caOf(c);
  return Math.round(ca + Math.max(0, est - ca) * GRADE_COEF[grade] + traitBonus(c));
}
export const ourValue = (s, c, grade) => valueOf(c, grade, ourEstimate(s, c));
const aiValue = (s, c, grade) => valueOf(c, grade, aiEstimate(s, c));

// 계파의 강점 분야 학생인지 (내줄 때 +30%): 입시파 지적, 체육부장 신체, 혁신파 창의성·기획력, 원로 언어력·논리력
function strongFor(f, c) {
  const avg = (keys) => keys.reduce((a, k) => a + c.s[idx(k)], 0) / keys.length;
  const all = avg(STATS);
  if (f === 'exam') return avg(MIND) >= all + 1;
  if (f === 'pe') return avg(BODY) >= all + 1;
  if (f === 'innov') return avg(['창의성', '기획력']) >= all + 1.5;
  if (f === 'elder') return avg(['언어력', '논리력']) >= all + 1.5;
  return false;
}

// ---------- 회의 시작: 업무 분장 + 기본 배정 ----------

// 지금 반 학생에게 소속 계파를 붙여 저장 형식으로 (8.0: 2·3학년 학생 계파는 반 지지도 비율)
function materialize(s, cls, rng) {
  if (cls.id === HOMEROOM_ID) return s.students.map((st) => toCompact({ ...st, faction: 'player' }, s.turn));
  const stored = s.school.rosters?.[cls.id];
  if (stored) return stored.map((c) => toCompact(fromCompact(c, s.turn), s.turn));
  const recruits = new Set((s.school.recruits?.[cls.id] ?? []).map((r) => r.id));
  return rosterOf(s, cls).map((st) => {
    const f = recruits.has(st.id) ? 'player' : rng.weighted(FACTION_KEYS.map((k) => [k, cls.support[k] + 0.01]));
    const c = toCompact({ ...st, faction: f }, s.turn);
    c.id = `${cls.id}-${st.id}`;
    return c;
  });
}

// 성적순 S자 배정 (실제 학교 방식)
function snake(pool, classIds) {
  const out = Object.fromEntries(classIds.map((id) => [id, []]));
  const sorted = [...pool].sort((a, b) => caOf(b) - caOf(a));
  sorted.forEach((c, i) => {
    const row = Math.floor(i / classIds.length), col = i % classIds.length;
    out[classIds[row % 2 === 0 ? col : classIds.length - 1 - col]].push(c);
  });
  return out;
}

export function startMeeting() {
  const s = getState();
  if (!isMeetingWeek(s)) return fail('반 편성 회의는 2월 4주에 열립니다.');
  const mt = ensureMeeting(s);
  if (mt.phase !== 'pre') return fail('이미 회의가 열렸습니다.');
  const rng = nextRng();
  const byGrade = (g) => s.school.classes.filter((c) => c.grade === g);
  const now = Object.fromEntries(s.school.classes.map((c) => [c.id, materialize(s, c, rng)]));
  const ids = (g) => byGrade(g).map((c) => c.id);
  // 3학년 졸업, 1→2학년, 2→3학년 진급, 신입생은 1학년으로
  const promote = (g) => byGrade(g).flatMap((c) => now[c.id]).map((c) => ({ ...c, g: g + 1, since: s.turn }));
  mt.graduates = byGrade(3).reduce((a, c) => a + now[c.id].length, 0);
  mt.next = { ...snake(promote(1), ids(2)), ...snake(promote(2), ids(3)), ...snake(mt.freshmen.map((c) => ({ ...c, since: s.turn })), ids(1)) };
  mt.phase = 'round';
  mt.round = 1;
  mt.left = PROPOSALS_PER_ROUND;
  mt.offers = makeOffers(s, mt, rng);
  mt.log.push('업무 분장: 반 타일의 주인은 그대로입니다. 3학년은 졸업하고, 1·2학년은 진급해 성적순 S자로 새 반에 배정됐습니다.');
  return done('반 편성 회의가 열렸습니다. 기본 배정이 끝났고, 협상 1라운드입니다.');
}

// 우리 계파가 가진 다음 해 반 (협상할 수 있는 반)
export const ourClasses = (s) => s.school.classes.filter((c) => c.owner === 'player');

const findIn = (mt, id) => { for (const [cid, list] of Object.entries(mt.next)) { const i = list.findIndex((c) => c.id === id); if (i >= 0) return { cid, i, c: list[i] }; } return null; };
const relMult = (s, f) => { const r = s.school.rel?.[f] ?? 0; return r >= 40 ? 0.9 : r <= -40 ? 1.3 : 1; };

// AI가 받아들일지 판정. 돌려주는 값: { ok, need, got }
export function judgeTrade(s, giveIds, takeId) {
  const mt = s.meeting;
  const take = findIn(mt, takeId);
  const gives = giveIds.map((id) => findIn(mt, id));
  const owner = classById(s, take.cid).owner;
  const grade = classById(s, take.cid).grade;
  const got = gives.reduce((a, g) => a + aiValue(s, g.c, grade), 0);
  const need = aiValue(s, take.c, grade) * relMult(s, owner) * (strongFor(owner, take.c) ? 1.3 : 1);
  const hostile = (s.school.rel?.[owner] ?? 0) <= -40;
  return { ok: !hostile && got >= need, need: Math.round(need), got: Math.round(got), owner };
}

export function proposeTrade(giveIds, takeId) {
  const s = getState();
  const mt = s.meeting;
  if (!mt || mt.phase !== 'round') return fail('협상 라운드가 아닙니다.');
  if (mt.left <= 0) return fail('이번 라운드 제안을 다 썼습니다 (라운드당 3건).');
  if (!giveIds.length || giveIds.length > 2) return fail('내줄 학생을 1~2명 골라 주세요.');
  const take = findIn(mt, takeId);
  const gives = giveIds.map((id) => findIn(mt, id));
  if (!take || gives.some((g) => !g)) return fail('없는 학생입니다.');
  const ourCls = gives[0].cid;
  if (gives.some((g) => g.cid !== ourCls) || classById(s, ourCls).owner !== 'player') return fail('내줄 학생은 우리 반 한 곳에서 골라 주세요.');
  if (classById(s, take.cid).owner === 'player') return fail('우리 반끼리는 거래할 필요가 없습니다.');
  if (classById(s, take.cid).grade !== classById(s, ourCls).grade) return fail('같은 학년 반끼리만 거래할 수 있습니다.');
  mt.left--;
  const j = judgeTrade(s, giveIds, takeId);
  const names = gives.map((g) => g.c.n).join('·');
  if (!j.ok) {
    mt.log.push(`[${mt.round}R] 거절: ${names} ↔ ${take.c.n} (${classLabel(take.cid)})`);
    return done(`${FACTIONS[j.owner].name} 쪽이 거절했습니다.${(s.school.rel?.[j.owner] ?? 0) <= -40 ? ' 적대 관계라 거래하지 않습니다.' : ''}`);
  }
  doTrade(mt, giveIds, takeId, ourCls, take.cid);
  mt.log.push(`[${mt.round}R] 성사: ${names} → ${classLabel(take.cid)}, ${take.c.n} → ${classLabel(ourCls)}`);
  count('trade');
  return done(`거래 성사: ${take.c.n}이(가) ${classLabel(ourCls)}으로 옵니다.`);
}

function doTrade(mt, giveIds, takeId, ourCls, theirCls) {
  const take = findIn(mt, takeId);
  mt.next[theirCls].splice(take.i, 1);
  const moved = [];
  for (const id of giveIds) {
    const g = findIn(mt, id);
    mt.next[ourCls].splice(g.i, 1);
    mt.next[theirCls].push(g.c);
    moved.push(g.c);
  }
  mt.next[ourCls].push(take.c);
  mt.trades.push({ give: giveIds, take: takeId, ours: ourCls, theirs: theirCls });
}

function undoTrade(mt, t) {
  const take = findIn(mt, t.take);
  mt.next[t.ours].splice(take.i, 1);
  mt.next[t.theirs].push(take.c);
  for (const id of t.give) { const g = findIn(mt, id); mt.next[t.theirs].splice(g.i, 1); mt.next[t.ours].push(g.c); }
}

// AI 쪽 제안: 우리 반 학생 중 AI가 보기에 값진 학생과, 자기 학생을 맞바꾸자고 한다
function makeOffers(s, mt, rng) {
  const offers = [];
  for (const ours of ourClasses(s)) {
    const rivals = s.school.classes.filter((c) => c.grade === ours.grade && c.owner !== 'player' && AI_FACTIONS.includes(c.owner) && (s.school.rel?.[c.owner] ?? 0) > -40);
    if (!rivals.length || rng.next() < 0.4) continue;
    const their = rng.pick(rivals);
    const want = [...mt.next[ours.id]].sort((a, b) => aiValue(s, b, ours.grade) - aiValue(s, a, ours.grade))[rng.int(0, 4)];
    const cands = mt.next[their.id].filter((c) => aiValue(s, c, ours.grade) < aiValue(s, want, ours.grade) * 0.97);
    if (!want || !cands.length) continue;
    const give = cands.sort((a, b) => aiValue(s, b, ours.grade) - aiValue(s, a, ours.grade))[0];
    offers.push({ from: their.owner, theirCls: their.id, ourCls: ours.id, want: want.id, give: give.id });
  }
  return offers.slice(0, 2);
}

export function answerOffer(i, accept) {
  const s = getState();
  const mt = s.meeting;
  const o = mt?.offers?.[i];
  if (!o || o.done) return fail('없는 제안입니다.');
  o.done = accept ? 'accepted' : 'declined';
  const want = findIn(mt, o.want), give = findIn(mt, o.give);
  if (!want || !give) return fail('이미 다른 거래로 바뀐 학생입니다.');
  if (accept) {
    doTrade(mt, [o.want], o.give, o.ourCls, o.theirCls);
    mt.log.push(`[${mt.round}R] ${FACTIONS[o.from].short} 제안 수락: ${want.c.n} → ${classLabel(o.theirCls)}, ${give.c.n} → ${classLabel(o.ourCls)}`);
    s.school.rel[o.from] = clamp((s.school.rel[o.from] ?? 0) + 3, -100, 100);
    return done(`${give.c.n}이(가) 우리 반으로 옵니다.`);
  }
  return done('제안을 거절했습니다.');
}

export function nextRound() {
  const s = getState();
  const mt = s.meeting;
  if (!mt || mt.phase !== 'round') return fail('협상 라운드가 아닙니다.');
  if (mt.round >= ROUNDS) return approve(s);
  mt.round++;
  mt.left = PROPOSALS_PER_ROUND;
  mt.offers = makeOffers(s, mt, nextRng());
  return done(`협상 ${mt.round}라운드입니다.`);
}

// ---------- 교감 승인 → 새 학년 ----------

export function approve(sArg) {
  const s = sArg ?? getState();
  const mt = s.meeting;
  if (!mt) return fail('회의가 없습니다.');
  if (mt.phase === 'pre') { const r = startMeeting(); if (!r.ok) return r; }
  const rng = nextRng();
  // 균형 검사 (10.5): 인원 28~32명, 반 평균 CA가 학년 평균의 ±10% 이내. 어긴 거래는 취소
  let complaints = 0;
  const cancelled = [];
  for (let guard = 0; guard < 20; guard++) {
    const bad = s.school.classes.find((c) => {
      const list = mt.next[c.id];
      const gradeAvg = s.school.classes.filter((x) => x.grade === c.grade).flatMap((x) => mt.next[x.id]).reduce((a, x) => a + caOf(x), 0) / (s.school.classes.filter((x) => x.grade === c.grade).reduce((a, x) => a + mt.next[x.id].length, 0));
      const avg = list.reduce((a, x) => a + caOf(x), 0) / list.length;
      c._why = list.length < SIZE_MIN || list.length > SIZE_MAX ? 'size' : Math.abs(avg - gradeAvg) > gradeAvg * 0.1 ? 'ca' : null;
      return c._why && mt.trades.some((t) => t.ours === c.id || t.theirs === c.id);
    });
    if (!bad) break;
    const t = [...mt.trades].reverse().find((x) => x.ours === bad.id || x.theirs === bad.id);
    undoTrade(mt, t);
    mt.trades.splice(mt.trades.indexOf(t), 1);
    cancelled.push(t);
    if (bad._why === 'ca') complaints++;
  }
  for (const c of s.school.classes) delete c._why;
  if (complaints) s.trust = clamp(s.trust - 5 * complaints, 0, 100);

  // 학생 희망 (10.5): 거래로 온 우리 반 학생은 25% 확률로 친구와 떨어져 사기 -1, 결속도 -20
  const unhappy = new Set(mt.trades.filter(() => rng.next() < 0.25).map((t) => t.take));

  // 지지도 재계산 (10.1): 이전 지지도 50% + 새 학생들의 소속 계파 비율 50%
  for (const c of s.school.classes) {
    const list = mt.next[c.id];
    if (c.id === HOMEROOM_ID) for (const x of list) x.f = 'player';
    const share = Object.fromEntries(FACTION_KEYS.map((k) => [k, (list.filter((x) => x.f === k).length / list.length) * 100]));
    for (const k of FACTION_KEYS) c.support[k] = c.support[k] * 0.5 + share[k] * 0.5;
    c.captain = null;
    c.record = { w: 0, l: 0, d: 0 };
    c.lowTurns = 0;
  }

  // 새 담임반: 1학년 4반 자리에 온 신입생들
  const rooms = ['1F-101', '1F-102', '1F-103', '1F-104', '1F-105', '1F-106', '2F-201', '2F-202'];
  const fresh = mt.next[HOMEROOM_ID].map((c) => fromCompact(c, s.turn)).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  fresh.forEach((st, i) => {
    st.no = i + 1;
    st.faction = 'player';
    st.bond = clamp(Math.round(50 + rng.gauss() * 8), 30, 70);
    st.needs = { play: rng.int(5, 25), home: rng.int(20, 45), grade: rng.int(5, 20), food: rng.int(10, 30), recog: rng.int(5, 20) };
    if (unhappy.has(st.id)) { shiftMorale(st, -1); st.bond = Math.max(0, st.bond - 20); }
  });
  rng.shuffle(fresh).forEach((st, i) => { st.room = rooms[Math.floor(i / 4)] ?? rooms[rooms.length - 1]; });
  const gem = [...fresh].sort((a, b) => (b.pa - b.ca) - (a.pa - a.ca))[0];
  if (gem) gem.tags = [...new Set([...gem.tags, 'gem'])];
  const leader = [...fresh].sort((a, b) => b.stats['통솔'] - a.stats['통솔'])[0];
  if (leader) leader.tags = [...new Set([...leader.tags, 'leader'])];
  const oldNames = s.students.length;
  // 진급한 학생에 대한 결정 대기 건은 정리한다
  const freshIds = new Set(fresh.map((x) => x.id));
  for (const m of s.inbox) if (m.choices && !m.resolved && m.ref?.studentId && !freshIds.has(m.ref.studentId)) { m.resolved = 'expired'; m.read = true; m.result = '학생이 진급해서 넘어갔습니다.'; }
  s.students = fresh;
  s.freeObservations = 3;

  // 다른 반은 저장된 명단으로
  s.school.rosters = Object.fromEntries(Object.entries(mt.next).filter(([id]) => id !== HOMEROOM_ID));
  s.school.recruits = {};
  // 담당 수업 반: 교무부장이면 학기 초에 다시 고를 수 있고, 아니면 1학년 3개 반 무작위
  if (placeById(s, 'dean')?.owner !== 'player') {
    s.school.teaching = rng.shuffle(s.school.classes.filter((c) => c.grade === 1 && c.id !== HOMEROOM_ID)).slice(0, 3).map((c) => c.id);
  }
  if (s.school.council) s.school.council.deanSem = null;

  const ourCount = (g) => s.school.classes.filter((c) => c.grade === g).reduce((a, c) => a + (s.school.rosters[c.id] ?? []).filter((x) => x.f === 'player').length, 0);
  mt.phase = 'done';
  mt.result = { trades: mt.trades.length, cancelled: cancelled.length, complaints, graduates: mt.graduates };
  // 저장 공간을 아끼려고 회의용 큰 자료는 지운다 (기록만 남김)
  delete mt.next; delete mt.freshmen; mt.offers = []; mt.scouted = {};
  addMessage({
    kind: 'info',
    title: '반 편성 회의가 끝났습니다',
    body: [
      `졸업생 ${mt.graduates}명. 담임반에서 키운 학생 ${oldNames}명은 2학년으로 진급했습니다 (2학년 우리 계파 학생 ${ourCount(2)}명, 3학년 ${ourCount(3)}명).`,
      `성사된 거래 ${mt.trades.length}건${cancelled.length ? `, 교감이 취소한 거래 ${cancelled.length}건` : ''}${complaints ? ` (성적 균형을 어겨 학부모 민원, 교장 신임 -${5 * complaints})` : ''}.`,
      '반마다 지지도를 다시 계산했습니다: 이전 지지도 50% + 새 학생들의 소속 계파 50%.',
      `1학년 4반에 신입생 ${fresh.length}명이 들어옵니다. 새 학년이 시작됩니다.`,
    ].join('\n'),
  });
  return done('교감 승인이 끝났습니다. 새 학년 반 편성이 확정됐습니다.');
}

// 주말 정산: 졸업식 알림, 회의 주인데 안 끝냈으면 기본 배정으로 확정
export function meetingWeekly(s) {
  const t = yearTurn(s.turn);
  if (t >= PRE_START) ensureMeeting(s);
  if (t === GRADUATION) addMessage({ kind: 'info', title: '졸업식', body: '3학년이 졸업했습니다. 다음 주 반 편성 회의에서 1·2학년이 진급하고 신입생이 배정됩니다.' });
  if (t === MEETING && s.meeting && s.meeting.phase !== 'done') approve(s);
}

export { classLabel };
