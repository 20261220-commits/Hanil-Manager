// 2막 전국 정복 1단계 (룰북 11.0, 11.5): 헥스 맵, 정복전, 자존심, 권역 장악, 전국 정복 승리
import { getState, save, addMessage, count, checkTitles } from './state.js';
import { makeRng, clamp } from './rng.js';
import { makeClassRoster } from './students.js';
import { REGIONS, HOME_REGION, regionAt, OUTLINE, JEJU_BOX, HEX, HOME, SCHOOLS, TIERS, LINES } from '../content/korea.js';

export const DECLARE_AP = 3;
// 정복전에서 우리 쪽 팀 전력 보정: 1막에서 장악한 본교 전체의 지원
export const HOME_SUPPORT = 0.08;

// ---------- 헥스 ----------

export function cellOf(lat, lon) {
  const row = Math.round((HEX.lat0 - lat) / HEX.dLat);
  const col = Math.round((lon - HEX.lon0 - (row % 2 ? HEX.dLon / 2 : 0)) / HEX.dLon);
  return { row, col };
}
const centerOf = (row, col) => ({ lat: HEX.lat0 - row * HEX.dLat, lon: HEX.lon0 + col * HEX.dLon + (row % 2 ? HEX.dLon / 2 : 0) });
const inside = (lon, lat, poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const key = (row, col) => `${row},${col}`;

let mapCache = null;
// 남한 본토 윤곽 안 + 제주 칸. 학교가 있는 칸은 반드시 넣는다
export function nationMap() {
  if (mapCache) return mapCache;
  const cells = new Map();
  const add = (row, col) => {
    const k = key(row, col);
    if (cells.has(k)) return cells.get(k);
    const c = centerOf(row, col);
    const cell = { key: k, row, col, ...c, region: regionAt(c.lat, c.lon), schools: [], home: false };
    cells.set(k, cell);
    return cell;
  };
  for (let row = 0; row < 28; row++) for (let col = 0; col < 14; col++) {
    const c = centerOf(row, col);
    const jeju = c.lat >= JEJU_BOX.lat[0] && c.lat <= JEJU_BOX.lat[1] && c.lon >= JEJU_BOX.lon[0] && c.lon <= JEJU_BOX.lon[1];
    if (inside(c.lon, c.lat, OUTLINE) || jeju) add(row, col);
  }
  for (const sc of SCHOOLS) { const { row, col } = cellOf(sc.lat, sc.lon); const cell = add(row, col); cell.schools.push(sc.id); cell.region = sc.region; }
  const h = cellOf(HOME.lat, HOME.lon);
  const hc = add(h.row, h.col); hc.home = true; hc.region = HOME_REGION;
  mapCache = { cells: [...cells.values()], byKey: cells, home: hc };
  return mapCache;
}

// 홀수 행 오프셋 좌표의 헥스 거리
function toCube(row, col) { const x = col - (row - (row & 1)) / 2; return { x, z: row, y: -x - row }; }
export function hexDistance(a, b) {
  const p = toCube(a.row, a.col), q = toCube(b.row, b.col);
  return Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y), Math.abs(p.z - q.z));
}
export const schoolById = (id) => SCHOOLS.find((x) => x.id === id);
export const cellOfSchool = (sc) => nationMap().byKey.get(key(cellOf(sc.lat, sc.lon).row, cellOf(sc.lat, sc.lon).col));
// 원정 거리: 칸 수 (제주는 바다 건너 +4칸)
export const awayDistance = (sc) => hexDistance(nationMap().home, cellOfSchool(sc)) + (sc.region === 'jeju' ? 4 : 0);

// ---------- 상태 ----------

export const inAct2 = (s) => !!s.act2;

export function ensureNation(s) {
  if (!s.act2) return null;
  s.nation ??= { schools: {}, declared: {}, won: null };
  for (const sc of SCHOOLS) s.nation.schools[sc.id] ??= { pride: TIERS[sc.tier].pride, owner: 'ai' };
  return s.nation;
}

export function startAct2() {
  const s = getState();
  if (!s.act1) return { ok: false, msg: '먼저 교장으로 추대돼야 합니다.' };
  s.act2 = { start: s.turn };
  s.act1.seen = true;
  ensureNation(s);
  addMessage({ kind: 'info', title: '2막: 전국 정복', body: '한일고가 본교가 됐습니다. 충청권에서 출발해 권역을 하나씩 넓혀 가며 전국 명문고를 꺾으세요. 권역은 그 권역 학교의 과반과 전국 명문(보스)을 모두 정복하면 장악합니다. 6개 권역을 모두 장악하면 전국 정복입니다.' });
  save();
  return { ok: true, msg: '2막이 시작됐습니다.' };
}

export function regionStatus(s, r) {
  const list = SCHOOLS.filter((x) => x.region === r);
  const owned = list.filter((x) => s.nation.schools[x.id].owner === 'player');
  const bosses = list.filter((x) => x.tier === 'boss');
  const bossOwned = bosses.filter((x) => s.nation.schools[x.id].owner === 'player');
  return { total: list.length, owned: owned.length, bosses: bosses.length, bossOwned: bossOwned.length,
    controlled: owned.length > list.length / 2 && bossOwned.length === bosses.length };
}

// 정복전을 걸 수 있는 권역: 본거지(충청권) + 장악한 권역 + 그 인접 권역
export function openRegions(s) {
  const base = new Set([HOME_REGION, ...Object.keys(REGIONS).filter((r) => regionStatus(s, r).controlled)]);
  const out = new Set(base);
  for (const r of base) for (const a of REGIONS[r].adj) out.add(a);
  return out;
}

export function declareBlock(s, id) {
  const sc = schoolById(id);
  if (!sc) return '없는 학교입니다.';
  const st = s.nation.schools[id];
  if (st.owner === 'player') return '이미 우리 분교입니다.';
  if (s.nation.declared[id]) return '이미 정복전을 선언했습니다.';
  if (!openRegions(s).has(sc.region)) return `${REGIONS[sc.region].name}은(는) 아직 손이 닿지 않습니다. 인접 권역을 먼저 장악하세요.`;
  if (s.ap < DECLARE_AP) return `AP가 부족합니다 (필요 ${DECLARE_AP}).`;
  return null;
}

export function declareWar(id) {
  const s = getState();
  ensureNation(s);
  const block = declareBlock(s, id); if (block) return { ok: false, msg: block };
  s.ap -= DECLARE_AP;
  s.nation.declared[id] = s.turn;
  checkTitles(); save();
  const sc = schoolById(id);
  return { ok: true, msg: `${sc.name}에 정복전을 선언했습니다. 이제 대결을 걸어 자존심을 0으로 만들면 분교가 됩니다.` };
}

// 상대 학교 명단
export function schoolRoster(s, sc) {
  const seed = [...sc.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 11) + s.seed;
  // 일반고는 우리와 같은 수준, 지역 명문 +1, 전국 명문 +2 (2학년 명단)
  const list = makeClassRoster(makeRng(seed), sc.tier === 'boss' ? 2 : 1, s.act2?.start ?? s.turn, 'school'); // 2막 시작 때 수준에 머문다 (우리만 자란다)
  const extra = sc.tier === 'regional' ? 1 : 0;
  list.forEach((st) => {
    st.id = `${sc.id}-${st.id}`;
    if (extra) for (const k in st.stats) st.stats[k] = Math.min(20, st.stats[k] + extra);
  });
  return list;
}
// 계열 강점 (종목별 팀 전력, 보스는 1.5배)
export const lineBonus = (sc, sport) => (LINES[sc.line].strong[sport] ?? 0) * (sc.tier === 'boss' ? 1.5 : 1);

// 정복전 대결 결과: 이기면 자존심이 깎이고, 0이 되면 분교
export function applySchoolResult(s, id, winnerIsUs, gradeKey) {
  const st = s.nation.schools[id];
  const sc = schoolById(id);
  if (winnerIsUs !== true) return { conquered: false, hit: 0 };
  const hit = { rout: 30, win: 20, close: 10 }[gradeKey] ?? 10;
  st.pride = Math.max(0, st.pride - hit);
  if (st.pride === 0) {
    st.owner = 'player';
    delete s.nation.declared[id];
    count('branch');
    // 소문: 같은 권역 다른 학교의 자존심도 흔들린다 (전국 명문은 덜)
    for (const o of SCHOOLS) {
      const os = s.nation.schools[o.id];
      if (o.region === sc.region && os.owner === 'ai') os.pride = Math.max(10, os.pride - (o.tier === 'boss' ? 5 : sc.tier === 'boss' ? 25 : 10));
    }
    addMessage({ kind: 'info', title: `${sc.name}이(가) 분교가 됐습니다`, body: `${sc.name}(${REGIONS[sc.region].name})의 자존심이 무너졌습니다. 이제 한일고의 분교입니다. 소문이 퍼져 ${REGIONS[sc.region].name} 다른 학교들의 자존심도 ${sc.tier === 'boss' ? 25 : 10}씩 떨어졌습니다 (전국 명문은 5).` });
    return { conquered: true, hit };
  }
  return { conquered: false, hit };
}

// 주말 정산: 자존심 회복(보스 2배), 분교 상납, 권역 장악 알림, 전국 정복 승리
export function nationWeekly(s) {
  if (!ensureNation(s)) return;
  for (const sc of SCHOOLS) {
    const st = s.nation.schools[sc.id];
    if (st.owner !== 'ai') continue;
    st.pride = Math.min(TIERS[sc.tier].pride, st.pride + (sc.tier === 'boss' ? 4 : 2));
  }
  const branches = SCHOOLS.filter((x) => s.nation.schools[x.id].owner === 'player').length;
  if (branches) s.budget += branches; // 분교 상납 (분교당 매주 1만원)
  s.nation.controlled ??= {};
  for (const r of Object.keys(REGIONS)) {
    const c = regionStatus(s, r).controlled;
    if (c && !s.nation.controlled[r]) addMessage({ kind: 'info', title: `${REGIONS[r].name} 장악`, body: `${REGIONS[r].name}을(를) 장악했습니다. 인접 권역에 정복전을 걸 수 있습니다.` });
    s.nation.controlled[r] = c;
  }
  if (!s.nation.won && Object.keys(REGIONS).every((r) => s.nation.controlled[r])) {
    s.nation.won = { turn: s.turn, branches };
    s.act2.won = true;
    addMessage({ kind: 'info', title: '전국 정복', body: '6개 권역을 모두 장악했습니다. 한일고가 대한민국 고교의 정점에 섰습니다.' });
  }
}

export { REGIONS, SCHOOLS, TIERS, LINES };
