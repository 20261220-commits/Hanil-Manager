// 교내 판도: 반 24개, 담임 교사, 반 지지도 (룰북 8.0, 8.2)
import { makeRng, clamp } from './rng.js';
import { makeClassRoster, fromCompact } from './students.js';
import { FACTION_KEYS, AI_FACTIONS, START_OWNERS, HOMEROOM_ID, FACTIONS, classLabel } from '../content/factions.js';
import { SURNAMES, GIVEN } from '../content/names.js';
import { MORALE } from '../content/stats.js';
import { PLACES, DORM_C } from '../content/places.js';
import { mod } from './persona.js';
import { yearTurn } from './calendar.js';

export const MORALE_MULT = [0.85, 0.92, 0.96, 1, 1.03, 1.06, 1.1];
export const moraleMult = (m) => MORALE_MULT[Math.max(0, MORALE.indexOf(m))];

// 남은 몫을 여러 세력에 무작위로 나눈다.
function spread(rng, amount, keys) {
  const w = keys.map(() => 0.3 + rng.next());
  const sum = w.reduce((a, b) => a + b, 0);
  return Object.fromEntries(keys.map((k, i) => [k, (amount * w[i]) / sum]));
}

function emptySupport() { return Object.fromEntries(FACTION_KEYS.map((k) => [k, 0])); }

function initialSupport(rng, grade, owner) {
  const sup = emptySupport();
  if (owner === 'player') { sup.player = 50; sup.none = 50; return sup; }
  if (owner === 'none') {
    const mine = grade === 1 ? 70 : 50;
    sup.none = mine;
    Object.assign(sup, spread(rng, 100 - mine, AI_FACTIONS));
    return sup;
  }
  // 계파 반: 주인 60%, 나머지 40%는 다른 AI 계파와 무소속. 1학년은 무소속 +20%p
  const mine = grade === 1 ? 50 : 60;
  sup[owner] = mine;
  const others = [...AI_FACTIONS.filter((k) => k !== owner), 'none'];
  const rest = spread(rng, 100 - mine - (grade === 1 ? 20 : 0), others);
  for (const k in rest) sup[k] += rest[k];
  if (grade === 1) sup.none += 20;
  return sup;
}

export function makeSchool(seed, teacherName) {
  const rng = makeRng(seed * 7 + 11);
  const used = new Set([teacherName]);
  const tname = () => {
    for (let i = 0; i < 50; i++) { const n = rng.weighted(SURNAMES) + rng.pick(GIVEN); if (!used.has(n)) { used.add(n); return n; } }
    return rng.weighted(SURNAMES) + rng.pick(GIVEN);
  };
  const classes = [];
  for (const grade of [1, 2, 3]) {
    const plan = START_OWNERS[grade];
    const rest = rng.shuffle(plan.rest);
    for (let no = 1; no <= 8; no++) {
      const owner = plan.fixed[no] ?? rest.shift();
      const id = `${grade}-${no}`;
      classes.push({
        id, grade, no, owner,
        teacher: owner === 'player' ? { name: teacherName, faction: 'player', lead: 0 } : { name: tname(), faction: owner, lead: rng.int(8, 14) },
        support: initialSupport(rng, grade, owner),
        captain: null,
        lowTurns: 0,
        seed: rng.int(1, 1e9),
        record: { w: 0, l: 0, d: 0 },
      });
    }
  }
  // 첫해 담당 수업: 1학년 3개 반 무작위 (담임반 제외)
  const teach = rng.shuffle(classes.filter((c) => c.grade === 1 && c.id !== HOMEROOM_ID)).slice(0, 3).map((c) => c.id);
  return { classes, teaching: teach, weather: '맑음', challenged: {}, ...extraTiles() };
}

// 반 말고 다른 타일과 AI 상태. 예전 세이브에도 덧붙인다.
export function extraTiles() {
  return {
    places: PLACES.map((p) => ({ id: p.id, owner: p.start })),
    ai: { gone: {}, elderNew: 0, news: [] },
  };
}

export const placeById = (s, id) => s.school.places.find((p) => p.id === id);
export const placeInfo = (id) => PLACES.find((p) => p.id === id);

// 그 계파의 대표 선수단: 가장 높은 학년의 반 (같으면 번호가 빠른 반). 무소속은 1학년 반.
export function championClass(s, faction) {
  const list = s.school.classes.filter((c) => c.owner === faction && (faction !== 'player' || c.id === HOMEROOM_ID));
  if (!list.length) return null;
  if (faction === 'none') return list.sort((a, b) => a.grade - b.grade || a.no - b.no)[0];
  return list.sort((a, b) => b.grade - a.grade || a.no - b.no)[0];
}

// 점령 비율 (플레이어 위협도 계산용): 반 + 야외 구역 + 특별실 + 핵심실
export function ownedRatio(s, faction) {
  const tiles = [...s.school.classes, ...s.school.places.filter((p) => placeInfo(p.id).kind !== 'base')];
  return tiles.filter((t) => t.owner === faction).length / tiles.length;
}

// 지도 색칠용: 건물 안 타일의 주인별 개수
export function buildingOwners(s, buildingId) {
  const out = {};
  const add = (k, n = 1) => { out[k] = (out[k] ?? 0) + n; };
  if (buildingId === 'gujak') for (const c of s.school.classes) add(c.owner);
  if (buildingId === 'hyeonje-c') { add('player', DORM_C.ours); add('none', DORM_C.rooms - DORM_C.ours); }
  for (const p of s.school.places) if (placeInfo(p.id).building === buildingId) add(p.owner);
  return out;
}

export const classById = (s, id) => s.school.classes.find((c) => c.id === id);

// 다른 반 학생 명단 (저장하지 않고 시드로 재생성)
// 반 편성 회의를 한 번 거친 반은 저장된 명단(s.school.rosters)을 쓴다.
export function rosterOf(s, cls) {
  if (cls.id === HOMEROOM_ID) return s.students;
  const stored = s.school.rosters?.[cls.id];
  if (stored) return stored.map((c) => fromCompact(c, s.turn));
  return makeClassRoster(makeRng(cls.seed), cls.grade, s.turn, cls.owner);
}

// 지지도 1위 세력
export function leader(cls) {
  return Object.entries(cls.support).sort((a, b) => b[1] - a[1])[0][0];
}

// from에서 to로 amount만큼 옮긴다. from이 'others'면 to를 뺀 나머지에서 비율대로 가져온다.
// fallback이면 from의 몫이 모자랄 때 나머지 세력에서 채운다.
export function transfer(cls, from, to, amount, fallback = true) {
  const sup = cls.support;
  let moved = 0;
  if (from !== 'others') {
    moved = Math.min(amount, sup[from]);
    sup[from] -= moved;
  }
  const left = amount - moved;
  if (left > 0 && (from === 'others' || fallback)) {
    const pool = FACTION_KEYS.filter((k) => k !== to && sup[k] > 0);
    const total = pool.reduce((a, k) => a + sup[k], 0);
    if (total > 0) {
      const take = Math.min(left, total);
      for (const k of pool) sup[k] -= take * (sup[k] / total);
      moved += take;
    }
  }
  sup[to] += moved;
  for (const k of FACTION_KEYS) sup[k] = clamp(sup[k], 0, 100);
  return moved;
}

export const playerClasses = (s) => s.school.classes.filter((c) => c.owner === 'player');

// 일상 영향력: 그 반의 우리 학생 1명당 (친화력 ÷ 20) × 0.5%p × 사기 배율.
// 지지도가 오를수록 남은 사람을 설득하기 어려워지므로 (1 - 지지도)² 만큼 줄어든다 (프로토타입 조정).
export function dailyInfluence(s, cls) {
  if (cls.id !== HOMEROOM_ID) return 0;
  const raw = s.students.reduce((a, st) => a + (st.stats['친화력'] / 20) * 0.5 * moraleMult(st.morale), 0) * (1 + mod(s, 'influence') / 100);
  return raw * (1 - cls.support.player / 100) ** 2;
}

// 주말 정산의 교내 판도 단계. 소식은 messages 배열로 돌려준다.
export function weeklySchool(s, rng) {
  const msgs = [];
  const sc = s.school;
  for (const cls of sc.classes) {
    const before = cls.support.player;
    // 일상 영향력, 담당 수업, 반장
    const daily = dailyInfluence(s, cls);
    if (daily > 0) transfer(cls, 'others', 'player', daily);
    if (sc.teaching.includes(cls.id)) transfer(cls, 'others', 'player', 1);
    if (cls.captain === 'player') transfer(cls, 'others', 'player', 1);
    // 반 주인은 지지도가 60% 밑이면 매주 조금씩 되찾는다 (방어)
    if (cls.owner !== 'player' && cls.support[cls.owner] < 60) transfer(cls, 'others', cls.owner, 0.6);
    if (cls.owner === 'player' && cls.id !== HOMEROOM_ID && cls.support.player < 60) transfer(cls, 'others', 'player', 0.5);
    cls.lastDelta = cls.support.player - before;

    // 지배권 상실: 점령한 반의 지지도가 50% 미만으로 4턴
    if (cls.owner === 'player' && cls.id !== HOMEROOM_ID) {
      cls.lowTurns = cls.support.player < 50 ? cls.lowTurns + 1 : 0;
      if (cls.lowTurns >= 4) {
        const next = Object.entries(cls.support).filter(([k]) => k !== 'player').sort((a, b) => b[1] - a[1])[0][0];
        cls.owner = next;
        cls.teacher.faction = next;
        cls.lowTurns = 0;
        msgs.push({ kind: 'warn', title: `${classLabel(cls.id)} 지배권을 잃었습니다`, body: `우리 지지도가 4주 동안 50%를 밑돌아 ${classLabel(cls.id)}이(가) ${FACTIONS[next].name} 쪽으로 넘어갔습니다.` });
      } else if (cls.lowTurns > 0) {
        msgs.push({ kind: 'warn', title: `${classLabel(cls.id)} 지배권이 흔들립니다 (${cls.lowTurns}/4주)`, body: `우리 지지도가 ${Math.round(cls.support.player)}%로 50% 밑입니다. 4주 동안 이어지면 지배권을 잃습니다.` });
      }
    }
  }

  // 3월 2주: 반장 선거 (8.2). 지지도 1위 세력의 후보가 유리하다.
  if (yearTurn(s.turn) === 2) {
    for (const cls of sc.classes) {
      if (cls.id === HOMEROOM_ID) continue;
      cls.captain = leader(cls);
    }
    // 담임반 반장 선거는 election.js에서 개표한다 (예전 세이브처럼 선거 상태가 없을 때만 여기서)
    const home = classById(s, HOMEROOM_ID);
    const cand = s.students.find((st) => st.tags.includes('leader')) ?? s.students[0];
    if (!s.election) {
      const p = clamp(0.35 + (home.support.player / 100) * 0.6 + (cand.stats['통솔'] - 10) * 0.02, 0.1, 0.9);
      if (rng.next() < p) {
        home.captain = 'player';
        transfer(home, 'others', 'player', 10);
        msgs.push({ kind: 'info', title: `반장 선거: ${cand.name} 당선`, body: `우리 쪽 후보 ${cand.name}이(가) 1학년 4반 반장이 됐습니다. 담임반 지지도 +10%p, 앞으로 매주 +1%p.` });
      } else {
        home.captain = 'none';
        msgs.push({ kind: 'info', title: '반장 선거: 낙선', body: `우리 쪽 후보 ${cand.name}이(가) 반장 선거에서 졌습니다. 무소속 학생이 반장이 됐습니다.` });
      }
    }
  }

  // 다음 주 날씨 (비 오면 야외 종목이 농구로 바뀜)
  sc.weather = rng.next() < 0.2 ? '비' : '맑음';
  sc.challenged = {};
  return msgs;
}

// 첫 학기 목표 (8.0): 담임반 지지도 70% 이상 + 반 1개 추가 점령
export function semesterGoal(s) {
  const home = classById(s, HOMEROOM_ID);
  const owned = playerClasses(s).length - 1;
  return { home: home.support.player, owned, ok: home.support.player >= 70 && owned >= 1 };
}
