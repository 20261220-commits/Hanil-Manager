// 대결 공통 엔진과 반 대항전 3종목 (룰북 9장)
// 화면과 저장을 모르는 순수 계산만 둔다. 경기 객체 m은 JSON으로 저장할 수 있는 모양이다.
import { clamp } from './rng.js';
import { MORALE } from '../content/stats.js';
import { PERSONALITIES, TALKS } from '../content/personality.js';
import { MORALE_MULT } from './school.js';

const PERS = Object.fromEntries(PERSONALITIES.map((p) => [p.name, p]));

// ---------- 종목 정의 ----------

const W = {
  // 축구
  GK: { 운동신경: 3, 집중력: 2, 평정심: 2, 피지컬: 1 },
  DF: { 피지컬: 3, 집중력: 2, 협력: 2, 체력: 1 },
  MF: { 체력: 3, 협력: 3, 의사결정: 2, 운동신경: 1 },
  FW: { 운동신경: 3, 적극성: 2, 승부욕: 2, 평정심: 1 },
  // 농구
  PG: { 의사결정: 3, 운동신경: 2, 통솔: 2, 협력: 1 },
  SG: { 운동신경: 3, 집중력: 2, 평정심: 2 },
  SF: { 운동신경: 2, 피지컬: 2, 체력: 2, 승부욕: 1 },
  PF: { 피지컬: 3, 체력: 2, 협력: 1, 적극성: 1 },
  C: { 피지컬: 3, 체력: 2, 집중력: 1 },
  // 야구
  P: { 집중력: 3, 운동신경: 2, 평정심: 2, 체력: 2 },
  RP: { 집중력: 3, 운동신경: 2, 평정심: 2, 체력: 2 },
  CA: { 집중력: 2, 의사결정: 2, 피지컬: 1 },
  IF: { 운동신경: 2, 집중력: 2, 협력: 1 },
  OF: { 운동신경: 3, 체력: 1 },
  BAT: { 운동신경: 3, 피지컬: 2, 집중력: 2, 평정심: 1 },
};
export const POS_LABEL = {
  GK: '골키퍼', DF: '수비', MF: '미드필더', FW: '공격',
  PG: '포인트가드', SG: '슈팅가드', SF: '스몰포워드', PF: '파워포워드', C: '센터',
  P: '투수', RP: '후보 투수', CA: '포수', '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: '유격수', LF: '좌익수', CF: '중견수', RF: '우익수',
};
const weightOf = (pos) => W[pos] ?? (['1B', '2B', '3B', 'SS'].includes(pos) ? W.IF : ['LF', 'CF', 'RF'].includes(pos) ? W.OF : W.MF);

// 해금은 교육과정(3.7절)에서 얻는다. 교육과정이 아직 없으므로 잠긴 선택지는 고를 수 없다.
const UNLOCKED = new Set();
export const isUnlocked = (opt) => !opt.lock || UNLOCKED.has(opt.lock);

export const SPORTS = {
  soccer: {
    name: '축구', venue: '운동장', outdoor: true, segs: ['전반', '후반', '추가시간'], subs: 3,
    margin: [3, 2], unit: '골',
    options: {
      formation: { label: '포메이션', pre: true, list: [
        { key: '4-4-2', desc: '기준' },
        { key: '4-3-3', desc: '공격 +5%, 미드 -5%', lock: '전술 이론' },
        { key: '4-5-1', desc: '미드 +5%, 공격 -5%', lock: '전술 이론' },
        { key: '3-5-2', desc: '미드 +5%, 수비 -5%', lock: '전문 코칭' },
      ] },
      tendency: { label: '성향', list: [
        { key: '공격적', desc: '기회 +1, 상대 득점 확률 +5%p' },
        { key: '균형', desc: '기준' },
        { key: '수비적', desc: '기회 -1, 상대 득점 확률 -8%p' },
      ] },
      style: { label: '스타일', list: [
        { key: '기본', desc: '기준' },
        { key: '점유', desc: '미드 전력 ×1.1, 득점 확률 -3%p' },
        { key: '역습', desc: '기회 -1, 득점 확률 +8%p' },
        { key: '압박', desc: '상대 기회 -1, 우리 체력 소모 ×1.5' },
      ] },
    },
    defaults: { formation: '4-4-2', tendency: '균형', style: '기본' },
    positions: (t) => {
      const n = { '4-4-2': [4, 4, 2], '4-3-3': [4, 3, 3], '4-5-1': [4, 5, 1], '3-5-2': [3, 5, 2] }[t.formation];
      return ['GK', ...Array(n[0]).fill('DF'), ...Array(n[1]).fill('MF'), ...Array(n[2]).fill('FW')];
    },
  },
  basketball: {
    name: '농구', venue: '무성관', outdoor: false, segs: ['1쿼터', '2쿼터', '3쿼터', '4쿼터'], subs: 10,
    margin: [15, 6], unit: '점',
    options: {
      lineup: { label: '라인업', pre: true, list: [
        { key: '균형', desc: 'PG·SG·SF·PF·C' },
        { key: '스몰', desc: '공격 횟수 +2, 3점 +3%p, 리바운드 -20%', lock: '전술 이론' },
        { key: '빅', desc: '리바운드 +20%, 공격 횟수 -1, 3점 -3%p', lock: '전문 코칭' },
      ] },
      offense: { label: '공격', list: [
        { key: '세트 오펜스', desc: '2점 +3%p, 공격 횟수 -2' },
        { key: '속공', desc: '공격 횟수 +2, 2점 -2%p' },
        { key: '3점 위주', desc: '3점 시도 30% → 50%' },
      ] },
      defense: { label: '수비', list: [
        { key: '맨투맨', desc: '기준' },
        { key: '지역방어', desc: '상대 2점 -5%p, 3점 +3%p', lock: '전술 이론' },
        { key: '풀코트 프레스', desc: '상대 턴오버 +8%p, 우리 체력 소모 ×1.5', lock: '전문 코칭' },
      ] },
    },
    defaults: { lineup: '균형', offense: '세트 오펜스', defense: '맨투맨' },
    positions: (t) => ({ 균형: ['PG', 'SG', 'SF', 'PF', 'C'], 스몰: ['PG', 'SG', 'SG', 'SF', 'PF'], 빅: ['PG', 'SF', 'PF', 'C', 'C'] }[t.lineup]),
  },
  baseball: {
    name: '야구', venue: '운동장', outdoor: true, segs: ['1~3회', '4~6회', '7~9회'], subs: 2,
    margin: [5, 2], unit: '점',
    options: {
      defense: { label: '수비 배치', list: [
        { key: '정상 수비', desc: '기준' },
        { key: '전진 수비', desc: '주자 3루 득점 -50%, 단타 +10%' },
        { key: '시프트', desc: '상대 장타자의 단타 -20%, 2루타 +10%', lock: '전술 이론' },
      ] },
      offense: { label: '공격 전술', list: [
        { key: '균형', desc: '기준' },
        { key: '강공', desc: '홈런 +25%, 아웃 +5%p' },
        { key: '스몰볼', desc: '번트·도루', lock: '전문 코칭' },
      ] },
    },
    defaults: { defense: '정상 수비', offense: '균형' },
    positions: () => ['P', 'CA', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'RP'],
  },
};

// 결과 등급 (9.6): 점수 차로 압승·승리·신승(석패)
export function resultGrade(sport, diff) {
  const [big, mid] = SPORTS[sport].margin;
  const d = Math.abs(diff);
  if (d === 0) return { key: 'draw', label: '무승부', swing: 0 };
  if (d >= big) return { key: 'rout', label: '압승', swing: 20 };
  if (d >= mid) return { key: 'win', label: '승리', swing: 12 };
  return { key: 'close', label: '신승', loseLabel: '석패', swing: 5 };
}

// ---------- 개인·팀 전력 ----------

const stat = (p, k) => p.stats[k] + (p.mods?.[k] ?? 0);
export function fit(p, pos) {
  const w = weightOf(pos);
  let sum = 0, tw = 0;
  for (const k in w) { sum += stat(p, k) * w[k]; tw += w[k]; }
  return sum / tw;
}

// 컨디션 배율 (9.2): 100% 1.00 · 80% 0.93 · 60% 0.85 · 40% 이하 0.75 사이를 잇는다.
export function condMult(c) {
  if (c >= 100) return 1;
  if (c >= 80) return 0.93 + (c - 80) * 0.0035;
  if (c >= 60) return 0.85 + (c - 60) * 0.004;
  if (c >= 40) return 0.75 + (c - 40) * 0.005;
  return 0.75;
}

const LUCK_P = { 빨: [0.01, 0.06], 주: [0.02, 0.04], 노: [0.03, 0.03], 연: [0.04, 0.02], 초: [0.06, 0.01] };

function power(m, side, id, pos) {
  const p = side.players[id];
  let v = fit(p, pos) * condMult(p.condition) * MORALE_MULT[Math.max(0, MORALE.indexOf(p.morale))];
  v *= side.segMult?.[id] ?? 1;
  // 승부욕: 지고 있는 팀은 마지막 구간에 개인 전력 + (승부욕 - 10) × 0.8%
  if (side.trailingLast) v *= 1 + (stat(p, '승부욕') - 10) * 0.008;
  return v;
}

function teamMult(m, side, opp) {
  const ids = side.lineup.filter((x) => x.pos !== 'RP').map((x) => x.id);
  const coop = 0.85 + (ids.reduce((a, id) => a + stat(side.players[id], '협력'), 0) / ids.length / 20) * 0.25;
  let mult = coop * (side.home ? 1.05 : 1) * (1 + (side.lead - 10) * 0.005 + (side.bonus ?? 0)) * side.form;
  if (m.sport === 'soccer') {
    const beats = { 공격적: '균형', 균형: '수비적', 수비적: '공격적' };
    if (beats[side.tactics.tendency] === opp.tactics.tendency) mult *= 1.05;
    else if (beats[opp.tactics.tendency] === side.tactics.tendency) mult *= 0.97;
  }
  return mult;
}

const lineAvg = (m, side, pos) => {
  const xs = side.lineup.filter((x) => x.pos === pos);
  return xs.length ? xs.reduce((a, x) => a + power(m, side, x.id, pos), 0) / xs.length : 0;
};
const teamAvg = (m, side) => {
  const xs = side.lineup.filter((x) => x.pos !== 'RP');
  return xs.reduce((a, x) => a + power(m, side, x.id, x.pos), 0) / xs.length;
};

// ---------- 명단 ----------

// 자리마다 가장 잘 맞는 학생을 넣는다 (점수 높은 짝부터 차례로).
export function autoLineup(players, positions, exclude = []) {
  const pool = players.filter((p) => !exclude.includes(p.id));
  const pairs = [];
  positions.forEach((pos, i) => pool.forEach((p) => pairs.push({ i, pos, id: p.id, v: fit(p, pos) * condMult(p.condition) })));
  pairs.sort((a, b) => b.v - a.v);
  const out = Array(positions.length), used = new Set();
  for (const x of pairs) {
    if (out[x.i] || used.has(x.id)) continue;
    out[x.i] = { pos: x.pos, id: x.id };
    used.add(x.id);
  }
  return out;
}

// 야구 타순: 타격이 좋은 순으로 3·4·5번에 강타자, 1·2번에 다음 타자
export function battingOrder(side) {
  const hitters = side.lineup.filter((x) => x.pos !== 'RP').map((x) => ({ id: x.id, v: fit(side.players[x.id], 'BAT') })).sort((a, b) => b.v - a.v);
  const slots = [3, 4, 2, 5, 1, 6, 7, 8, 9];
  const order = Array(9);
  hitters.forEach((h, i) => { order[slots[i] - 1] = h.id; });
  return order;
}

// ---------- 경기 만들기 ----------

// side 입력: { key, name, faction, lead, bonus, home, players: [학생], lineup?, tactics? }
export function createMatch(sport, a, b, rng) {
  const mk = (x) => {
    const tactics = { ...SPORTS[sport].defaults, ...(x.tactics ?? {}) };
    const players = {};
    for (const p of x.players) {
      players[p.id] = { id: p.id, name: p.name, stats: { ...p.stats }, morale: p.morale, condition: p.condition, luck: p.luck,
        personality: p.personality, trait: p.trait, mods: {} };
    }
    const list = Object.values(players);
    const lineup = x.lineup ?? autoLineup(list, SPORTS[sport].positions(tactics));
    return {
      key: x.key, name: x.name, faction: x.faction, lead: x.lead, bonus: x.bonus ?? 0, home: !!x.home,
      players, lineup, tactics, subsLeft: SPORTS[sport].subs,
      form: clamp(1 + rng.gauss() * 0.15, 0.6, 1.4), // 경기 당일 컨디션 (9.3)
      stats: {}, segMult: {}, used: lineup.map((l) => l.id),
      bat: 0, pitcher: { id: lineup.find((l) => l.pos === 'P')?.id, faced: 0, fatigue: 1, relieved: false },
    };
  };
  const m = { sport, seg: 0, score: [0, 0], segScore: [], log: [], done: false, sides: [mk(a), mk(b)], innings: 0 };
  if (sport === 'baseball') for (const s of m.sides) s.order = battingOrder(s);
  return m;
}

// 대결 전 훈화 (9.5): 압박 → 승부욕 계열, 격려 → 사기, 침착 → 평정심 계열
export function preTalk(m, sideIdx, kind, motivation, rng) {
  const side = m.sides[sideIdx];
  const base = 0.4 + motivation * 0.025;
  let up = 0, down = 0;
  for (const l of side.lineup) {
    const p = side.players[l.id];
    const r = PERS[p.personality]?.talk[kind] ?? '○';
    if (p.trait === '마이웨이') continue;
    const prob = r === '◎' ? Math.min(0.95, base * 1.5) : base;
    if (rng.next() >= prob) continue;
    if (r === '✕' || (kind === 0 && p.trait === '유리멘탈')) {
      p.morale = MORALE[clamp(MORALE.indexOf(p.morale) - 1, 0, 6)];
      down++;
    } else {
      if (kind === 0) { p.mods['승부욕'] = 3; p.mods['적극성'] = 2; }
      if (kind === 1) p.morale = MORALE[clamp(MORALE.indexOf(p.morale) + 1, 0, 6)];
      if (kind === 2) { p.mods['평정심'] = 3; p.mods['집중력'] = 1; }
      up++;
    }
  }
  m.log.push({ seg: -1, side: sideIdx, text: `${side.name} 경기 전 훈화 "${TALKS[kind]}": 먹힌 학생 ${up}명${down ? `, 역효과 ${down}명` : ''}` });
}

// ---------- 구간 진행 ----------

const addStat = (side, id, k, v = 1) => { side.stats[id] ??= {}; side.stats[id][k] = (side.stats[id][k] ?? 0) + v; };

function pickWeighted(rng, items) {
  const total = items.reduce((a, x) => a + x[1], 0);
  let r = rng.next() * total;
  for (const x of items) { r -= x[1]; if (r < 0) return x[0]; }
  return items[items.length - 1][0];
}

// 구간 시작: 행운·기행 판정 (9.4)
function rollSegmentEvents(m, rng) {
  const segName = SPORTS[m.sport].segs[Math.min(m.seg, SPORTS[m.sport].segs.length - 1)];
  m.sides.forEach((side, si) => {
    side.segMult = {};
    for (const l of side.lineup) {
      if (l.pos === 'RP') continue;
      const p = side.players[l.id];
      const [good, bad] = LUCK_P[p.luck] ?? LUCK_P.노;
      const r = rng.next();
      if (r < good) { side.segMult[l.id] = 1.3; m.log.push({ seg: m.seg, side: si, tone: 'good', text: `${segName}: ${p.name}에게 행운이 따릅니다 (전력 ×1.3)` }); }
      else if (r < good + bad) { side.segMult[l.id] = 0.7; m.log.push({ seg: m.seg, side: si, tone: 'bad', text: `${segName}: ${p.name}이(가) 운이 없습니다 (전력 ×0.7)` }); }
      if (rng.next() < stat(p, '기행') * 0.005) {
        const goodWay = rng.next() < 0.3 + stat(p, '절제') * 0.025;
        side.segMult[l.id] = (side.segMult[l.id] ?? 1) * (goodWay ? 1.4 : 0.5);
        m.log.push({ seg: m.seg, side: si, tone: goodWay ? 'good' : 'bad',
          text: goodWay ? `${segName}: ${p.name}의 돌발 행동이 통했습니다 (전력 ×1.4)` : `${segName}: ${p.name}이(가) 엉뚱한 짓을 했습니다 (전력 ×0.5)` });
      }
    }
  });
  // 지고 있는 팀은 마지막 구간에 승부욕 보너스
  const last = m.seg === SPORTS[m.sport].segs.length - 1;
  m.sides[0].trailingLast = last && m.score[0] < m.score[1];
  m.sides[1].trailingLast = last && m.score[1] < m.score[0];
}

function drainStamina(m, scale = 1) {
  for (const side of m.sides) {
    const press = (m.sport === 'soccer' && side.tactics.style === '압박') || (m.sport === 'basketball' && side.tactics.defense === '풀코트 프레스') ? 1.5 : 1;
    for (const l of side.lineup) {
      if (l.pos === 'RP') continue;
      const p = side.players[l.id];
      p.condition = clamp(Math.round(p.condition - (15 - stat(p, '체력') * 0.5) * press * scale), 20, 100);
    }
  }
}

function soccerSegment(m, rng) {
  const [A, B] = m.sides;
  const segName = SPORTS.soccer.segs[m.seg];
  const fmod = (side, pos) => ({ '4-3-3': { FW: 1.05, MF: 0.95 }, '4-5-1': { MF: 1.05, FW: 0.95 }, '3-5-2': { MF: 1.05, DF: 0.95 } }[side.tactics.formation]?.[pos] ?? 1);
  const lines = m.sides.map((side, i) => {
    const tm = teamMult(m, side, m.sides[1 - i]);
    return Object.fromEntries(['GK', 'DF', 'MF', 'FW'].map((pos) => [pos, lineAvg(m, side, pos) * fmod(side, pos) * tm]));
  });
  const mid = m.sides.map((side, i) => lines[i].MF * (side.tactics.style === '점유' ? 1.1 : 1));
  const chances = [0, 0];
  for (let k = 0; k < 6; k++) chances[rng.next() < mid[0] / (mid[0] + mid[1]) ? 0 : 1]++;
  m.sides.forEach((side, i) => {
    const o = m.sides[1 - i];
    if (side.tactics.tendency === '공격적') chances[i]++;
    if (side.tactics.tendency === '수비적') chances[i]--;
    if (side.tactics.style === '역습') chances[i]--;
    if (o.tactics.style === '압박') chances[i]--;
    chances[i] = Math.max(0, chances[i]);
  });
  const seg = [0, 0];
  const range = [[1, 45], [46, 90], [90, 96]][m.seg];
  const goals = [];
  m.sides.forEach((side, i) => {
    const o = m.sides[1 - i];
    let p = 0.2 * (lines[i].FW / ((lines[1 - i].DF + lines[1 - i].GK) / 2));
    if (side.tactics.style === '역습') p += 0.08;
    if (side.tactics.style === '점유') p -= 0.03;
    if (o.tactics.tendency === '공격적') p += 0.05;
    if (o.tactics.tendency === '수비적') p -= 0.08;
    p = clamp(p, 0.05, 0.6);
    for (let c = 0; c < chances[i]; c++) {
      const shooters = side.lineup.filter((l) => l.pos === 'FW' || l.pos === 'MF').map((l) => [l, power(m, side, l.id, l.pos) * (l.pos === 'FW' ? 3 : 1)]);
      const shooter = pickWeighted(rng, shooters);
      addStat(side, shooter.id, 'shots');
      if (rng.next() < p) {
        seg[i]++;
        addStat(side, shooter.id, 'goals');
        goals.push({ min: rng.int(range[0], range[1]), si: i, name: side.players[shooter.id].name });
      }
    }
  });
  goals.sort((a, b) => a.min - b.min);
  for (const g of goals) {
    m.score[g.si]++;
    m.log.push({ seg: m.seg, side: g.si, tone: 'goal', text: `${g.min}분 ⚽ ${g.name} 골! (${m.score[0]}:${m.score[1]})` });
  }
  m.log.push({ seg: m.seg, side: null, text: `${segName} 끝: 슈팅 기회 ${A.name} ${chances[0]} · ${B.name} ${chances[1]}` });
  // 실점 기록 (골키퍼·수비 평점용)
  m.sides.forEach((side, i) => { for (const l of side.lineup) if (l.pos === 'GK' || l.pos === 'DF') addStat(side, l.id, 'conceded', seg[1 - i]); });
  m.segScore.push(seg);
  drainStamina(m);
}

function basketballSegment(m, rng) {
  const segName = SPORTS.basketball.segs[Math.min(m.seg, 3)];
  const tm = m.sides.map((side, i) => teamMult(m, side, m.sides[1 - i]));
  const team = m.sides.map((side, i) => teamAvg(m, side) * tm[i]);
  const big = m.sides.map((side, i) => {
    const xs = side.lineup.filter((l) => l.pos === 'PF' || l.pos === 'C');
    return (xs.reduce((a, l) => a + power(m, side, l.id, l.pos), 0) / Math.max(1, xs.length)) * tm[i];
  });
  const seg = [0, 0];
  const play = (i, n) => {
    const side = m.sides[i], o = m.sides[1 - i];
    const r = team[i] / team[1 - i];
    const t = side.tactics, ot = o.tactics;
    let p2 = 0.48 * r ** 0.6 + (t.offense === '세트 오펜스' ? 0.03 : 0) + (t.offense === '속공' ? -0.02 : 0) + (ot.defense === '지역방어' ? -0.05 : 0);
    let p3 = 0.34 * r ** 0.6 + (t.lineup === '스몰' ? 0.03 : 0) + (t.lineup === '빅' ? -0.03 : 0) + (ot.defense === '지역방어' ? 0.03 : 0);
    p2 = clamp(p2, 0.25, 0.7); p3 = clamp(p3, 0.15, 0.5);
    const share3 = t.offense === '3점 위주' ? 0.5 : 0.3;
    const to = 0.12 + (ot.defense === '풀코트 프레스' ? 0.08 : 0);
    const reb = clamp(0.27 * (big[i] / big[1 - i]) * (t.lineup === '스몰' ? 0.8 : t.lineup === '빅' ? 1.2 : 1), 0.1, 0.45);
    const shooters = side.lineup.map((l) => [l, power(m, side, l.id, l.pos) * ({ PG: 1, SG: 1.4, SF: 1.3, PF: 1, C: 1 }[l.pos] ?? 1)]);
    for (let k = 0; k < n; k++) {
      if (rng.next() < to) continue;
      for (let tries = 0; tries < 3; tries++) {
        const three = rng.next() < share3;
        const sh = pickWeighted(rng, shooters);
        if (rng.next() < (three ? p3 : p2)) {
          const pts = three ? 3 : 2;
          seg[i] += pts;
          addStat(side, sh.id, 'pts', pts);
          break;
        }
        if (rng.next() >= reb) break;
        const bigs = side.lineup.filter((l) => l.pos === 'PF' || l.pos === 'C');
        if (bigs.length) addStat(side, rng.pick(bigs).id, 'reb');
      }
    }
  };
  const poss = (side) => 15 + (side.tactics.offense === '속공' ? 2 : 0) + (side.tactics.offense === '세트 오펜스' ? -2 : 0) + (side.tactics.lineup === '스몰' ? 2 : 0) + (side.tactics.lineup === '빅' ? -1 : 0);
  play(0, poss(m.sides[0])); play(1, poss(m.sides[1]));
  m.score[0] += seg[0]; m.score[1] += seg[1];
  m.log.push({ seg: m.seg, side: null, text: `${segName} ${seg[0]}:${seg[1]} (합계 ${m.score[0]}:${m.score[1]})` });
  // 4쿼터가 끝났는데 동점이면 연장 (공격 5회씩)을 반복한다. 무승부 없음.
  if (m.seg === 3) {
    let ot = 0;
    while (m.score[0] === m.score[1] && ot < 8) {
      ot++;
      const before = [...seg];
      play(0, 5); play(1, 5);
      const d = [seg[0] - before[0], seg[1] - before[1]];
      m.score[0] += d[0]; m.score[1] += d[1];
      m.log.push({ seg: m.seg, side: null, tone: 'goal', text: `연장 ${ot}차 ${d[0]}:${d[1]} (합계 ${m.score[0]}:${m.score[1]})` });
    }
    if (m.score[0] === m.score[1]) { const w = rng.next() < 0.5 ? 0 : 1; m.score[w] += 1; m.log.push({ seg: m.seg, side: w, text: '마지막 자유투로 승부가 갈렸습니다' }); }
  }
  m.segScore.push(seg);
  drainStamina(m, 0.75);
}

// 야구: 3이닝씩 3구간. 원정(도전한 쪽)이 초, 홈(도전받은 쪽)이 말 공격
function baseballSegment(m, rng) {
  const seg = [0, 0];
  const halfInning = (bi, inning) => {
    const bat = m.sides[bi], fld = m.sides[1 - bi];
    const tmB = teamMult(m, bat, fld), tmF = teamMult(m, fld, bat);
    let outs = 0, runs = 0;
    const bases = [null, null, null];
    const fielders = fld.lineup.filter((l) => !['P', 'RP'].includes(l.pos));
    const def = (fielders.reduce((a, l) => a + power(m, fld, l.id, l.pos), 0) / fielders.length) * tmF;
    const score = (id) => { runs++; if (id) addStat(bat, id, 'r'); };
    while (outs < 3) {
      const pit = fld.pitcher;
      const pitPos = pit.relieved ? 'RP' : 'P';
      const pitch = power(m, fld, pit.id, pitPos) * pit.fatigue * tmF;
      const id = bat.order[bat.bat % 9];
      bat.bat++;
      const hitter = bat.players[id];
      const ratio = (fit(hitter, 'BAT') * condMult(hitter.condition) * (bat.segMult[id] ?? 1) * tmB) / (pitch * 0.65 + def * 0.35);
      const hs = ratio ** 0.9;
      let p1 = 0.17 * hs, p2 = 0.05 * hs, p3 = 0.01 * hs, hr = 0.03 * hs;
      const bb = 0.08 * ratio ** 0.5;
      if (bat.tactics.offense === '강공') { hr *= 1.25; p1 = Math.max(0.03, p1 - 0.05); }
      if (fld.tactics.defense === '전진 수비') p1 *= 1.1;
      const r = rng.next();
      addStat(bat, id, 'pa');
      // 투수 피로: 상대한 타자가 (15 + 체력)을 넘으면 타자마다 ×0.97, 85% 밑이면 후보 투수로 교체
      pit.faced++;
      if (pit.faced > 15 + stat(fld.players[pit.id], '체력')) pit.fatigue *= 0.97;
      const rpEntry = fld.lineup.find((l) => l.pos === 'RP');
      if (pit.fatigue < 0.85 && !pit.relieved && rpEntry) {
        m.log.push({ seg: m.seg, side: 1 - bi, text: `${inning}회: ${fld.players[pit.id].name} 지쳐서 강판, 후보 투수 ${fld.players[rpEntry.id].name} 등판` });
        fld.pitcher = { id: rpEntry.id, faced: 0, fatigue: 1, relieved: true };
      }
      let rbi = 0;
      const before = runs;
      if (r < bb) {
        // 볼넷: 밀어내기
        if (bases[0]) { if (bases[1]) { if (bases[2]) score(bases[2]); bases[2] = bases[1]; } bases[1] = bases[0]; }
        bases[0] = id;
        addStat(bat, id, 'bb');
      } else if (r < bb + hr) {
        for (const b of bases) if (b) score(b);
        score(id);
        bases.fill(null);
        addStat(bat, id, 'h'); addStat(bat, id, 'hr');
        m.log.push({ seg: m.seg, side: bi, tone: 'goal', text: `${inning}회${bi ? '말' : '초'}: ${hitter.name} 홈런! (${m.score[0] + (bi === 0 ? seg[0] + runs : seg[0])}:${m.score[1] + (bi === 1 ? seg[1] + runs : seg[1])})` });
      } else if (r < bb + hr + p3) {
        for (const b of bases) if (b) score(b);
        bases.fill(null); bases[2] = id;
        addStat(bat, id, 'h');
      } else if (r < bb + hr + p3 + p2) {
        if (bases[2]) score(bases[2]);
        if (bases[1]) score(bases[1]);
        const first = bases[0];
        bases.fill(null);
        if (first) { if (rng.next() < 0.4) score(first); else bases[2] = first; }
        bases[1] = id;
        addStat(bat, id, 'h');
      } else if (r < bb + hr + p3 + p2 + p1) {
        if (bases[2]) score(bases[2]);
        const second = bases[1];
        bases[2] = null;
        if (second) { if (rng.next() < 0.5) score(second); else bases[2] = second; }
        bases[1] = bases[0];
        bases[0] = id;
        addStat(bat, id, 'h');
      } else {
        outs++;
        addStat(fld, pit.id, 'outs');
        if (outs < 3 && bases[2] && rng.next() < (fld.tactics.defense === '전진 수비' ? 0.175 : 0.35)) { score(bases[2]); bases[2] = null; }
      }
      rbi = runs - before;
      if (rbi) { addStat(bat, id, 'rbi', rbi); addStat(fld, pit.id, 'ra', rbi); }
      // 9회 이후 말 공격에서 앞서면 끝내기
      if (bi === 1 && inning >= 9 && m.score[1] + seg[1] + runs > m.score[0] + seg[0]) break;
      if (bat.bat > 400) break;
    }
    seg[bi] += runs;
  };
  const playInning = (inning) => {
    halfInning(0, inning);
    if (!(inning >= 9 && m.score[1] + seg[1] > m.score[0] + seg[0])) halfInning(1, inning);
    m.innings = inning;
  };
  for (let k = 1; k <= 3; k++) playInning(m.seg * 3 + k);
  // 동점이면 12회까지 연장, 그래도 같으면 무승부
  if (m.seg === 2) {
    let inning = 9;
    while (m.score[0] + seg[0] === m.score[1] + seg[1] && inning < 12) { inning++; playInning(inning); }
  }
  m.score[0] += seg[0]; m.score[1] += seg[1];
  m.log.push({ seg: m.seg, side: null, text: `${SPORTS.baseball.segs[m.seg]} ${seg[0]}:${seg[1]} (합계 ${m.score[0]}:${m.score[1]}${m.seg === 2 && m.innings > 9 ? `, ${m.innings}회 연장` : ''})` });
  m.segScore.push(seg);
  drainStamina(m, 0.7);
}

export function playSegment(m, rng) {
  if (m.done) return;
  rollSegmentEvents(m, rng);
  ({ soccer: soccerSegment, basketball: basketballSegment, baseball: baseballSegment })[m.sport](m, rng);
  m.seg++;
  if (m.seg >= SPORTS[m.sport].segs.length) finishMatch(m, rng);
}

// ---------- 작전 타임 ----------

export function substitute(m, si, outId, inId) {
  const side = m.sides[si];
  if (side.subsLeft <= 0) return '교체 횟수를 다 썼습니다.';
  const slot = side.lineup.find((l) => l.id === outId);
  if (!slot || side.lineup.some((l) => l.id === inId) || !side.players[inId]) return '교체할 수 없습니다.';
  if (slot.pos === 'P' && side.pitcher.id === outId) side.pitcher = { id: inId, faced: 0, fatigue: 1, relieved: false };
  if (m.sport === 'baseball') side.order = side.order.map((x) => (x === outId ? inId : x));
  slot.id = inId;
  side.subsLeft--;
  if (!side.used.includes(inId)) side.used.push(inId);
  m.log.push({ seg: m.seg - 1, side: si, text: `교체: ${side.players[outId].name} → ${side.players[inId].name} (${POS_LABEL[slot.pos]})` });
  return null;
}

// AI의 작전 타임: 지고 있으면 공세로 바꾸고, 많이 지친 학생을 교체한다.
export function aiTimeout(m, si, rng, smart = 0.6) {
  const side = m.sides[si];
  const behind = m.score[si] < m.score[1 - si];
  if (behind && rng.next() < smart) {
    if (m.sport === 'soccer') side.tactics.tendency = '공격적';
    if (m.sport === 'basketball') side.tactics.offense = rng.next() < 0.5 ? '속공' : '3점 위주';
    if (m.sport === 'baseball') side.tactics.offense = '강공';
  }
  if (m.sport === 'baseball') return;
  const tired = side.lineup.filter((l) => side.players[l.id].condition < 65).sort((a, b) => side.players[a.id].condition - side.players[b.id].condition);
  for (const l of tired) {
    if (side.subsLeft <= 0) break;
    const bench = Object.values(side.players).filter((p) => !side.lineup.some((x) => x.id === p.id)).sort((a, b) => fit(b, l.pos) * condMult(b.condition) - fit(a, l.pos) * condMult(a.condition));
    if (bench[0] && fit(bench[0], l.pos) * condMult(bench[0].condition) > fit(side.players[l.id], l.pos) * condMult(side.players[l.id].condition)) substitute(m, si, l.id, bench[0].id);
  }
}

// ---------- 결과 ----------

function finishMatch(m, rng) {
  m.done = true;
  const diff = m.score[0] - m.score[1];
  m.grade = resultGrade(m.sport, diff);
  m.winner = diff > 0 ? 0 : diff < 0 ? 1 : null;
  // 평점 1.0~10.0
  m.ratings = m.sides.map((side, i) => {
    const opp = m.sides[1 - i];
    const oppAvg = m.sides[1 - i].lineup.length ? teamAvg(m, opp) : 1;
    const out = {};
    for (const id of side.used) {
      const st = side.stats[id] ?? {};
      const l = side.lineup.find((x) => x.id === id);
      const p = side.players[id];
      let r = 6.0 + (m.winner === i ? 0.4 : m.winner === null ? 0 : -0.3);
      if (l) r += (fit(p, l.pos) / oppAvg - 1) * 2.5;
      if (m.sport === 'soccer') {
        r += (st.goals ?? 0) * 1.0 + (st.shots ?? 0) * 0.05;
        if (l?.pos === 'GK') r += (st.conceded ?? 0) === 0 ? 0.8 : -(st.conceded) * 0.35;
        if (l?.pos === 'DF') r += (st.conceded ?? 0) === 0 ? 0.4 : -(st.conceded) * 0.15;
      } else if (m.sport === 'basketball') {
        r += (st.pts ?? 0) * 0.09 + (st.reb ?? 0) * 0.15 - 0.6;
      } else {
        r += (st.h ?? 0) * 0.35 + (st.hr ?? 0) * 0.6 + (st.rbi ?? 0) * 0.25 + (st.bb ?? 0) * 0.1 - ((st.pa ?? 0) - (st.h ?? 0) - (st.bb ?? 0)) * 0.08;
        if (st.outs) r += st.outs * 0.04 - (st.ra ?? 0) * 0.3;
      }
      r += rng.gauss() * 0.25;
      out[id] = Math.round(clamp(r, 1, 10) * 10) / 10;
    }
    return out;
  });
  const pool = m.winner === null ? [0, 1] : [m.winner];
  let best = null;
  for (const si of pool) for (const [id, r] of Object.entries(m.ratings[si])) if (!best || r > best.r) best = { si, id, r };
  m.mvp = best;
}

// ---------- 자동 설정 ----------

// 해금된 전술 조합을 모두 시험해 보고 승률이 가장 높은 것을 고른다.
// 상대 분석이 없으므로 상대는 우리와 비슷한 평균적인 팀(우리 반 복제)으로 가정한다 (9.8).
export function bestTactics(sport, base, rngFactory, n = 30) {
  const def = SPORTS[sport];
  const keys = Object.keys(def.options).filter((k) => !def.options[k].pre);
  const choices = keys.map((k) => def.options[k].list.filter(isUnlocked).map((o) => o.key));
  const combos = choices.reduce((acc, list, i) => acc.flatMap((c) => list.map((v) => ({ ...c, [keys[i]]: v }))), [{}]);
  let best = null;
  for (const combo of combos) {
    let pts = 0;
    for (let t = 0; t < n; t++) {
      const rng = rngFactory(t);
      const a = { ...base, tactics: { ...base.tactics, ...combo }, key: 'a', home: false };
      const b = { ...base, tactics: { ...def.defaults, ...Object.fromEntries(Object.entries(base.tactics).filter(([k]) => def.options[k]?.pre)) }, key: 'b', home: false };
      const m = createMatch(sport, a, b, rng);
      m.sides.forEach((s) => { s.form = 1; });
      while (!m.done) playSegment(m, rng);
      pts += m.winner === 0 ? 1 : m.winner === null ? 0.5 : 0;
    }
    if (!best || pts > best.pts) best = { pts, combo };
  }
  return best.combo;
}

// 예상 승률: 같은 조건으로 여러 번 돌려 본다 (교사 안목이 낮으면 추정이 흔들린다).
export function estimateWin(sport, a, b, rngFactory, n = 120) {
  let w = 0, d = 0;
  for (let t = 0; t < n; t++) {
    const rng = rngFactory(t);
    const m = createMatch(sport, a, b, rng);
    while (!m.done) playSegment(m, rng);
    if (m.winner === 0) w++; else if (m.winner === null) d++;
  }
  return { win: w / n, draw: d / n };
}
